plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "in.daqwon.ops"
    compileSdk = 37

    defaultConfig {
        applicationId = "in.daqwon.ops"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
        // Finance API lives on the realtime backend; the app talks to it directly with a session token.
        buildConfigField("String", "API_BASE", "\"https://realtime-production-f5e0.up.railway.app\"")
        manifestPlaceholders["cleartext"] = "false"
    }

    buildTypes {
        debug {
            // Local testing only: ./gradlew assembleDebug -PopsApi=http://10.0.2.2:4000 (emulator -> this PC).
            val localApi = (project.findProperty("opsApi") as String?)
            if (localApi != null) {
                buildConfigField("String", "API_BASE", "\"$localApi\"")
                manifestPlaceholders["cleartext"] = localApi.startsWith("http://").toString()
                applicationIdSuffix = ".local"
            }
        }
        release {
            isMinifyEnabled = false
            // Signed with the debug key so it installs directly; replace with a private key before any wider sharing.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.09.00")
    implementation(composeBom)
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.core:core-ktx:1.19.1")
    implementation("androidx.biometric:biometric:1.1.0")
    implementation("androidx.security:security-crypto:1.1.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
}
