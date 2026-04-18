package expo.modules.expensebuddysmsimport

import android.content.Context
import org.json.JSONObject
import org.tensorflow.lite.Interpreter
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import java.util.Locale

private const val MODEL_ASSET_PATH = "sms_ml/seed-litert-embed-augmented-v1/model.tflite"
private const val METADATA_ASSET_PATH = "sms_ml/seed-litert-embed-augmented-v1/metadata.json"

data class SmsCategoryPredictionRequest(
  val messageId: String,
  val sender: String,
  val body: String,
  val merchantName: String?,
)

data class SmsCategoryPredictionResult(
  val messageId: String,
  val category: String,
  val confidence: Double,
  val shouldUsePrediction: Boolean,
  val modelId: String,
)

private data class SmsCategoryModelMetadata(
  val modelId: String,
  val labels: List<String>,
  val hashBucketSize: Int,
  val hashSalt: String,
  val minTokenLength: Int,
  val maxTokenLength: Int,
  val maxTokens: Int,
  val maxSequenceLength: Int,
  val ngramSeparator: String,
  val minConfidence: Double,
)

class SmsCategoryLiteRtClassifier private constructor(
  private val metadata: SmsCategoryModelMetadata,
  private val interpreter: Interpreter,
) {
  private val digest = MessageDigest.getInstance("SHA-256")
  private val lock = Any()

  fun classifyBatch(
    requests: List<SmsCategoryPredictionRequest>,
  ): List<SmsCategoryPredictionResult> {
    return requests.map(::classify)
  }

  private fun classify(request: SmsCategoryPredictionRequest): SmsCategoryPredictionResult {
    val features = buildFeatureSequence(request)
    val output = Array(1) { FloatArray(metadata.labels.size) }

    synchronized(lock) {
      interpreter.run(arrayOf(features), output)
    }

    val probabilities = output[0]
    var bestIndex = 0
    var bestScore = Double.NEGATIVE_INFINITY
    for (index in probabilities.indices) {
      val score = probabilities[index].toDouble()
      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    }

    val category = metadata.labels[bestIndex]
    val confidence = bestScore.coerceIn(0.0, 1.0)
    return SmsCategoryPredictionResult(
      messageId = request.messageId,
      category = category,
      confidence = confidence,
      shouldUsePrediction = confidence >= metadata.minConfidence && category != "Other",
      modelId = metadata.modelId,
    )
  }

  private fun buildFeatureSequence(request: SmsCategoryPredictionRequest): IntArray {
    val featureText = listOf(request.sender, request.merchantName.orEmpty(), request.body)
      .filter { it.isNotBlank() }
      .joinToString(" ")
      .lowercase(Locale.ROOT)
    val terms = iterTerms(tokenizeText(featureText)).take(metadata.maxSequenceLength)
    val features = IntArray(metadata.maxSequenceLength)

    for ((index, term) in terms.withIndex()) {
      features[index] = stableHashBucket(term) + 1
    }

    return features
  }

  private fun tokenizeText(text: String): List<String> {
    val tokenPattern = Regex("[a-z0-9]{${metadata.minTokenLength},${metadata.maxTokenLength}}")
    return tokenPattern.findAll(text)
      .map { it.value }
      .take(metadata.maxTokens)
      .toList()
  }

  private fun iterTerms(tokens: List<String>): List<String> {
    val terms = tokens.toMutableList()
    for (index in 0 until tokens.lastIndex) {
      terms.add(tokens[index] + metadata.ngramSeparator + tokens[index + 1])
    }
    return terms
  }

  private fun stableHashBucket(term: String): Int {
    val input = (metadata.hashSalt + "\u0000" + term).toByteArray(Charsets.UTF_8)
    val rawHash = synchronized(digest) {
      digest.digest(input)
    }
    val unsignedValue = ByteBuffer.wrap(rawHash, 0, 4).order(ByteOrder.BIG_ENDIAN).int
      .toLong() and 0xffffffffL
    return (unsignedValue % metadata.hashBucketSize.toLong()).toInt()
  }

  companion object {
    @Volatile
    private var instance: SmsCategoryLiteRtClassifier? = null

    fun getInstance(context: Context): SmsCategoryLiteRtClassifier {
      instance?.let { return it }

      return synchronized(this) {
        instance?.let { return it }

        val metadata = loadMetadata(context)
        val interpreter = Interpreter(loadModelBuffer(context), Interpreter.Options().setNumThreads(2))
        SmsCategoryLiteRtClassifier(metadata, interpreter).also { instance = it }
      }
    }

    private fun loadMetadata(context: Context): SmsCategoryModelMetadata {
      val payload = context.assets.open(METADATA_ASSET_PATH).use { input ->
        input.bufferedReader(Charsets.UTF_8).readText()
      }
      val json = JSONObject(payload)
      val labelsJson = json.getJSONArray("labels")
      val labels = buildList(labelsJson.length()) {
        for (index in 0 until labelsJson.length()) {
          add(labelsJson.getString(index))
        }
      }

      return SmsCategoryModelMetadata(
        modelId = json.getString("model_id"),
        labels = labels,
        hashBucketSize = json.getInt("hash_bucket_size"),
        hashSalt = json.getString("hash_salt"),
        minTokenLength = json.getInt("min_token_length"),
        maxTokenLength = json.getInt("max_token_length"),
        maxTokens = json.getInt("max_tokens"),
        maxSequenceLength = json.getInt("max_sequence_length"),
        ngramSeparator = json.getString("ngram_separator"),
        minConfidence = json.getDouble("min_confidence"),
      )
    }

    private fun loadModelBuffer(context: Context): ByteBuffer {
      val modelBytes = context.assets.open(MODEL_ASSET_PATH).use { input -> input.readBytes() }
      return ByteBuffer.allocateDirect(modelBytes.size)
        .order(ByteOrder.nativeOrder())
        .put(modelBytes)
        .apply { rewind() }
    }
  }
}