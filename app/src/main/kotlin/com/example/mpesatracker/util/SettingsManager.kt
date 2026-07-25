package com.example.mpesatracker.util

import android.content.Context

class SettingsManager(context: Context) {
    private val prefs = context.getSharedPreferences("mpesa_tracker_prefs", Context.MODE_PRIVATE)

    var mpesaNumber: String
        get() = prefs.getString("mpesaNumber", "") ?: ""
        set(value) = prefs.edit().putString("mpesaNumber", value).apply()

    var displayName: String
        get() = prefs.getString("displayName", "") ?: ""
        set(value) = prefs.edit().putString("displayName", value).apply()
}
