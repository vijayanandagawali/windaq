buildscript {
    // AGP 9 compiles Kotlin itself; this pins the Kotlin version it uses.
    dependencies { classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.4.0") }
}
plugins {
    id("com.android.application") version "9.4.1" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.0" apply false
}

// Build output stays outside the OneDrive-synced folder: syncing locks files mid-build.
System.getenv("LOCALAPPDATA")?.let { local ->
    allprojects { layout.buildDirectory.set(file("$local/WinDaqOpsBuild/${project.name}")) }
}
