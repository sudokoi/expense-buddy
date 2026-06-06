package expo.modules.expensebuddygoogleauth

import android.app.Activity
import android.util.Log
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Scope
import expo.modules.kotlin.Promise
import expo.modules.kotlin.events.OnActivityResultPayload
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val TAG = "ExpenseBuddyGoogleAuth"
private const val GOOGLE_SIGN_IN_REQUEST_CODE = 31030
private const val DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata"

private class GoogleAuthNoActivityException :
    CodedException(
        code = "ERR_GOOGLE_AUTH_NO_ACTIVITY",
        message = "No foreground activity is available.",
        cause = null,
    )

private class GoogleAuthFailedException(
    code: String,
    message: String,
) : CodedException(
        code = code,
        message = message,
        cause = null,
    )

class ExpenseBuddyGoogleAuthModule : Module() {
    private var authResultPromise: Promise? = null

    override fun definition() =
        ModuleDefinition {
            Name("ExpenseBuddyGoogleAuth")

            AsyncFunction("startGoogleDriveOAuthAsync") { webClientId: String, promise: Promise ->
                val activity = appContext.currentActivity
                if (activity == null) {
                    Log.w(TAG, "No foreground activity available")
                    promise.reject(GoogleAuthNoActivityException())
                    return@AsyncFunction
                }

                authResultPromise = promise
                Log.d(TAG, "Starting Google Drive OAuth")

                val options =
                    GoogleSignInOptions
                        .Builder()
                        .requestScopes(Scope(DRIVE_APPDATA_SCOPE))
                        .requestServerAuthCode(webClientId)
                        .requestEmail()
                        .build()

                GoogleSignIn
                    .getClient(activity, options)
                    .signInIntent
                    .let { intent ->
                        Log.d(TAG, "Launching sign-in intent")
                        activity.startActivityForResult(intent, GOOGLE_SIGN_IN_REQUEST_CODE)
                    }
            }

            OnActivityResult { _: Activity, payload: OnActivityResultPayload ->
                handleSignInResult(payload)
            }
        }

    private fun handleSignInResult(payload: OnActivityResultPayload) {
        if (payload.requestCode != GOOGLE_SIGN_IN_REQUEST_CODE) return

        val promise = authResultPromise
        authResultPromise = null
        if (promise == null) {
            Log.w(TAG, "Sign-in result received but no promise waiting")
            return
        }

        Log.d(TAG, "Sign-in result: resultCode=${payload.resultCode}")

        if (payload.resultCode == Activity.RESULT_CANCELED || payload.data == null) {
            Log.d(TAG, "User cancelled sign-in")
            promise.resolve(null)
            return
        }

        if (payload.resultCode != Activity.RESULT_OK) {
            Log.w(TAG, "Unexpected result code: ${payload.resultCode}")
            promise.resolve(null)
            return
        }

        try {
            val task = GoogleSignIn.getSignedInAccountFromIntent(payload.data)
            val account = task.getResult(ApiException::class.java)

            val serverAuthCode = account.serverAuthCode ?: ""
            val email = account.email ?: ""

            Log.d(TAG, "Sign-in successful: email=$email, hasCode=${serverAuthCode.isNotEmpty()}")

            promise.resolve(
                mapOf(
                    "serverAuthCode" to serverAuthCode,
                    "email" to email,
                ),
            )
        } catch (e: ApiException) {
            when (e.statusCode) {
                CommonStatusCodes.SIGN_IN_REQUIRED,
                CommonStatusCodes.CANCELED,
                -> {
                    Log.d(TAG, "Sign-in cancelled (status=${e.statusCode})")
                    promise.resolve(null)
                }
                CommonStatusCodes.DEVELOPER_ERROR -> {
                    Log.e(
                        TAG,
                        "DEVELOPER_ERROR: likely SHA-1 mismatch or client misconfiguration. statusCode=${e.statusCode}, msg=${e.localizedMessage}",
                    )
                    promise.reject(
                        GoogleAuthFailedException(
                            code = "ERR_GOOGLE_AUTH_CONFIG",
                            message = "Google Sign-In configuration error: ${e.localizedMessage}.",
                        ),
                    )
                }
                else -> {
                    Log.e(TAG, "Google Sign-In failed: statusCode=${e.statusCode}, msg=${e.localizedMessage}")
                    promise.reject(
                        GoogleAuthFailedException(
                            code = "ERR_GOOGLE_AUTH_FAILED",
                            message = "Google Sign-In failed (${e.statusCode}): ${e.localizedMessage}",
                        ),
                    )
                }
            }
        }
    }
}
