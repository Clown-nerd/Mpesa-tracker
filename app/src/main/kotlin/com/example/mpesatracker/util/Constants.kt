package com.example.mpesatracker.util

data class CategoryInfo(
    val id: String,
    val label: String,
    val icon: String,
    val color: String
)

object Constants {
    val INCOME_SOURCES = mapOf(
        "GIG" to CategoryInfo("GIG", "Gig / Freelance", "💼", "#6366F1"),
        "STIPEND" to CategoryInfo("STIPEND", "Parents / Family", "👨‍👩‍👧", "#F97316"),
        "HELB" to CategoryInfo("HELB", "HELB", "🎓", "#3B82F6"),
        "SALARY" to CategoryInfo("SALARY", "Salary", "💰", "#10B981"),
        "BUSINESS" to CategoryInfo("BUSINESS", "Business", "🏪", "#14B8A6"),
        "REFUND" to CategoryInfo("REFUND", "Refund", "↩️", "#F59E0B"),
        "OTHER_INCOME" to CategoryInfo("OTHER_INCOME", "Other Income", "📥", "#6B7280")
    )

    val CATEGORIES = mapOf(
        "FOOD" to CategoryInfo("FOOD", "Food & Dining", "🍽️", "#FF6B6B"),
        "TRANSPORT" to CategoryInfo("TRANSPORT", "Transport", "🚌", "#4ECDC4"),
        "CLOTHING" to CategoryInfo("CLOTHING", "Clothing", "👗", "#A855F7"),
        "RENT" to CategoryInfo("RENT", "Rent & Housing", "🏠", "#F97316"),
        "INTERNET" to CategoryInfo("INTERNET", "Internet & Airtime", "📱", "#3B82F6"),
        "INVESTMENTS" to CategoryInfo("INVESTMENTS", "Investments", "📈", "#10B981"),
        "LOANS" to CategoryInfo("LOANS", "Loans & Fuliza", "💳", "#EF4444"),
        "ELECTRICITY" to CategoryInfo("ELECTRICITY", "Electricity", "⚡", "#F59E0B"),
        "TRANSFERS" to CategoryInfo("TRANSFERS", "Personal Transfers", "💸", "#6366F1"),
        "SHOPPING" to CategoryInfo("SHOPPING", "Shopping", "🛍️", "#EC4899"),
        "HEALTH" to CategoryInfo("HEALTH", "Health", "🏥", "#14B8A6"),
        "ENTERTAINMENT" to CategoryInfo("ENTERTAINMENT", "Entertainment", "🎬", "#8B5CF6"),
        "SAVINGS" to CategoryInfo("SAVINGS", "Savings", "🏦", "#00A86B"),
        "OTHER" to CategoryInfo("OTHER", "Other", "📦", "#6B7280")
    )


}
