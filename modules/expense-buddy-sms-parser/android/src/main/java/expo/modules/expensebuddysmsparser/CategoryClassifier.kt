package expo.modules.expensebuddysmsparser

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

interface CategoryClassifier {
    fun classify(requests: List<SmsCategoryPredictionRequest>): List<SmsCategoryPredictionResult>
}
