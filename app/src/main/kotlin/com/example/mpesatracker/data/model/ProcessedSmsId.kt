package com.example.mpesatracker.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "processed_sms_ids")
data class ProcessedSmsId(
    @PrimaryKey val smsId: String,
    val createdAt: Long = System.currentTimeMillis()
)
