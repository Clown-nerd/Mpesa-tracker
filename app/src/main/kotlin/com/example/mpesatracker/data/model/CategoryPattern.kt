package com.example.mpesatracker.data.model

import androidx.room.Entity

@Entity(
    tableName = "category_patterns",
    primaryKeys = ["kind", "party", "category"]
)
data class CategoryPattern(
    val kind: String, // "expense" or "income"
    val party: String,
    val category: String, // Category ID or Income Source ID
    val count: Int = 1
)
