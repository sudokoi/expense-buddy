package expo.modules.expensebuddysmsimport

import android.content.Context
import org.json.JSONObject
import org.tensorflow.lite.Interpreter
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import java.util.Locale

private const val MODEL_ASSET_PATH = "sms_ml/seed-litert-v1/model.tflite"
private const val METADATA_ASSET_PATH = "sms_ml/seed-litert-v1/metadata.json"

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
  val featureDimension: Int,
  val hashSalt: String,
  val maxTokens: Int,
  val ngramSeparator: String,
  val minConfidence: Double,
)

class SmsCategoryLiteRtClassifier private constructor(
  private val metadata: SmsCategoryModelMetadata,
  private val interpreter: Interpreter,
) {
  private val tokenPattern = Regex("[a-z0-9]{2,32}")
  private val digest = MessageDigest.getInstance("SHA-256")
  private val lock = Any()

  fun classifyBatch(
    requests: List<SmsCategoryPredictionRequest>,
  ): List<SmsCategoryPredictionResult> {
    return requests.map(::classify)
  }

  private fun classify(request: SmsCategoryPredictionRequest): SmsCategoryPredictionResult {
    val features = buildFeatureVector(request)
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

  private fun buildFeatureVector(request: SmsCategoryPredictionRequest): FloatArray {
    val featureText = listOf(request.sender, request.merchantName.orEmpty(), request.body)
      .filter { it.isNotBlank() }
      .joinToString(" ")
      .lowercase(Locale.ROOT)
    val tokens = tokenPattern.findAll(featureText)
      .map { it.value }
      .take(metadata.maxTokens)
      .toList()
    val features = FloatArray(metadata.featureDimension)

    for (token in tokens) {
      features[stableHashIndex(token)] += 1f
    }

    for (index in 0 until tokens.lastIndex) {
      val bigram = tokens[index] + metadata.ngramSeparator + tokens[index + 1]
      features[stableHashIndex(bigram)] += 1f
    }

    var squaredSum = 0.0
    for (value in features) {
      squaredSum += value * value
    }
    if (squaredSum > 0.0) {
      val norm = kotlin.math.sqrt(squaredSum).toFloat()
      for (index in features.indices) {
        features[index] /= norm
      }
    }

    return features
  }

  private fun stableHashIndex(term: String): Int {
    val input = (metadata.hashSalt + "\u0000" + term).toByteArray(Charsets.UTF_8)
    val rawHash = synchronized(digest) {
      digest.digest(input)
    }
    val unsignedValue = ByteBuffer.wrap(rawHash, 0, 4).order(ByteOrder.BIG_ENDIAN).int
      .toLong() and 0xffffffffL
    return (unsignedValue % metadata.featureDimension.toLong()).toInt()
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
        featureDimension = json.getInt("feature_dimension"),
        hashSalt = json.getString("hash_salt"),
        maxTokens = json.getInt("max_tokens"),
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