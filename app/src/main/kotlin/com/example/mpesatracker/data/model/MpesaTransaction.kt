package com.example.mpesatracker.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "transactions")
data class MpesaTransaction(
    @PrimaryKey val id: String,
    val confirmationCode: String?,
    val type: String,
    val amount: Double,
    val party: String?,
    val accountNumber: String?,
    val paybillNumber: String?,
    val date: Long, // timestamp
    val rawMessage: String?,
    val isExpense: Boolean,
    val isIncome: Boolean,
    val balance: Double?,
    val category: String?,
    val categorized: Boolean,
    val incomeSource: String?,
    val note: String?,
    val createdAt: Long = System.currentTimeMillis()
)
