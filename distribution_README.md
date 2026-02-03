Distribution interne - builds APK / IPA

But: these workflows require secrets and an Apple Developer account to produce signed IPA/APK.

Secrets to add in your repo (Settings → Secrets):

- ANDROID_KEYSTORE_BASE64: base64 content of your keystore (.jks)
- ANDROID_KEYSTORE_PASSWORD
- ANDROID_KEY_ALIAS
- ANDROID_KEY_PASSWORD

- APPLE_CERT_P12_BASE64: base64 content of your iOS certificate (.p12)
- APPLE_CERT_P12_PASSWORD
- IOS_PROVISIONING_PROFILE_BASE64: base64 content of your provisioning profile (.mobileprovision)

How to trigger:
- Push the workflows or run manually from Actions → select workflow → Run workflow.
- After run, download artifacts (APK / IPA) from the Actions run page.

Notes:
- iOS signing requires Apple Developer account (Ad-Hoc requires UDIDs; Enterprise requires Enterprise account).
- I can help you produce the base64 blobs for secrets if you provide the files securely.
- If you prefer I perform the build on my side, you must provide the keystore and Apple certificates (secrets); otherwise run the workflow yourself.
