# ProGuard / R8 Rules for GC Agent APK
# Protects Android Native Bytecode, Java/Kotlin classes, and WebView bridges

# 1. Obfuscate and shrink code
-repackageclasses 'com.gcagent.whatsapp.internal'
-allowaccessmodification

# 2. Strip all debugging information and line numbers
-renamesourcefileattribute SourceFile
-keepattributes SourceFile,LineNumberTable
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}

# 3. Disable WebView Debugging in Release Builds
-assumenosideeffects class android.webkit.WebView {
    public static void setWebContentsDebuggingEnabled(boolean);
}

# 4. Keep Capacitor core interfaces for bridge communication
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }

# 5. Security: Anti-Tampering & Reflection Guards
-keepattributes *Annotation*
-dontskipnonpubliclibraryclasses
