package com.example.mpesatracker.util

import com.example.mpesatracker.data.local.CategoryPatternDao
import com.example.mpesatracker.data.model.CategoryPattern
import com.example.mpesatracker.data.model.MpesaTransaction

object CategoryLearning {

    private const val AUTO_THRESHOLD = 3
    private const val BUSINESS_THRESHOLD = 3

    val KEYWORD_MAP = mapOf(
        // Food & Dining
        "java house" to "FOOD",
        "artcaffe" to "FOOD",
        "chicken inn" to "FOOD",
        "kfc" to "FOOD",
        "pizza inn" to "FOOD",
        "burger king" to "FOOD",
        "subway" to "FOOD",
        "naivas" to "FOOD",
        "quickmart" to "FOOD",
        "foodplus" to "FOOD",
        "cleanshelf" to "FOOD",
        "chandarana" to "FOOD",
        "glovo" to "FOOD",
        "uber eats" to "FOOD",
        "jumia food" to "FOOD",
        "mama ngina" to "FOOD",

        // Transport
        "uber" to "TRANSPORT",
        "bolt" to "TRANSPORT",
        "little ride" to "TRANSPORT",
        "little cab" to "TRANSPORT",
        "swvl" to "TRANSPORT",
        "faras" to "TRANSPORT",
        "wasili" to "TRANSPORT",
        "mondo ride" to "TRANSPORT",

        // Internet & Airtime
        "safaricom" to "INTERNET",
        "airtel" to "INTERNET",
        "telkom" to "INTERNET",
        "faiba" to "INTERNET",
        "zuku" to "INTERNET",
        "starlink" to "INTERNET",

        // Shopping
        "carrefour" to "SHOPPING",
        "game stores" to "SHOPPING",
        "jumia" to "SHOPPING",
        "masoko" to "SHOPPING",
        "woolworths" to "SHOPPING",

        // Electricity
        "kplc" to "ELECTRICITY",
        "kenya power" to "ELECTRICITY",

        // Health
        "nairobi hospital" to "HEALTH",
        "aga khan" to "HEALTH",
        "mater hospital" to "HEALTH",
        "kenyatta hospital" to "HEALTH",
        "sha" to "HEALTH",
        "britam" to "HEALTH",

        // Transfers (Banking)
        "equity" to "TRANSFERS",
        "kcb" to "TRANSFERS",
        "co-operative" to "TRANSFERS",
        "cooperative" to "TRANSFERS",
        "stanbic" to "TRANSFERS",
        "absa" to "TRANSFERS",
        "ncba" to "TRANSFERS",
        "dtb" to "TRANSFERS",
        "family bank" to "TRANSFERS",
        "i&m" to "TRANSFERS",

        // Rent & Housing
        "nairobi water" to "RENT",

        // Entertainment
        "showmax" to "ENTERTAINMENT",
        "netflix" to "ENTERTAINMENT",
        "spotify" to "ENTERTAINMENT",
        "dstv" to "ENTERTAINMENT",
        "multichoice" to "ENTERTAINMENT",
        "crunchyroll" to "ENTERTAINMENT",

        // Savings & Investments
        "m-shwari" to "SAVINGS",
        "mshwari" to "SAVINGS",
        "kcb m-pesa" to "SAVINGS",
        "ziidi" to "INVESTMENTS",
        "cytonn" to "INVESTMENTS",

        // Loans
        "fuliza" to "LOANS",
        "tala" to "LOANS",
        "branch" to "LOANS",
        "zenka" to "LOANS"
    )

    private val KENYAN_BUSINESS_PATTERNS = listOf(
        """\b(?:ltd|limited|plc|inc|enterprises?|stores?|supermarket|pharmacy|hospital|hotel|restaurant|cafe|academy|services?)\b""".toRegex(RegexOption.IGNORE_CASE),
        """\b(?:kenya|nairobi|mombasa|kisumu|nakuru|eldoret|thika|nyeri|machakos|kiambu)\b""".toRegex(RegexOption.IGNORE_CASE),
        """^[a-z\s]+(pay|mart|shop|hub|point|center|centre|world|palace|corner|junction)\b""".toRegex(RegexOption.IGNORE_CASE)
    )

    private val SORTED_KEYWORDS = KEYWORD_MAP.keys.sortedByDescending { it.length }

    fun normalizeParty(party: String?): String? {
        if (party.isNullOrBlank()) return null
        return party.lowercase()
            .replace("""\d{10,}""".toRegex(), "")
            .replace("""\s+""".toRegex(), " ")
            .trim().ifBlank { null }
    }

    fun isKnownBusinessPattern(normalizedParty: String?): Boolean {
        if (normalizedParty == null) return false
        return KENYAN_BUSINESS_PATTERNS.any { it.containsMatchIn(normalizedParty) }
    }

    fun keywordMatch(normalizedParty: String?): String? {
        if (normalizedParty == null) return null
        for (keyword in SORTED_KEYWORDS) {
            if (normalizedParty.contains(keyword)) {
                return KEYWORD_MAP[keyword]
            }
        }
        return null
    }

    suspend fun predictCategory(party: String?, kind: String, dao: CategoryPatternDao): String? {
        val key = normalizeParty(party) ?: return null

        if (kind == "expense") {
            val kw = keywordMatch(key)
            if (kw != null) return kw
        }

        // 1. Check exact match
        val rows = dao.getPatternsForParty(kind, key)
        if (rows.isNotEmpty()) {
            val best = rows[0]
            val secondCount = if (rows.size > 1) rows[1].count else 0
            val threshold = if (isKnownBusinessPattern(key)) BUSINESS_THRESHOLD else AUTO_THRESHOLD
            if (best.count >= threshold && best.count > secondCount) {
                return best.category
            }
        }

        // 2. Check partial/fuzzy substring matches with learned patterns
        val allPatterns = dao.getAllPatterns(kind)
        val matchingPattern = allPatterns.firstOrNull { pattern ->
            val pKey = pattern.party.lowercase()
            key.contains(pKey) || pKey.contains(key)
        }
        if (matchingPattern != null) {
            val threshold = if (isKnownBusinessPattern(key) || isKnownBusinessPattern(matchingPattern.party)) BUSINESS_THRESHOLD else AUTO_THRESHOLD
            if (matchingPattern.count >= threshold) {
                return matchingPattern.category
            }
        }

        return null
    }

    suspend fun recordCategorization(party: String?, categoryOrSource: String?, kind: String, dao: CategoryPatternDao) {
        val key = normalizeParty(party) ?: return
        if (categoryOrSource.isNullOrBlank()) return

        val existing = dao.getPattern(kind, key, categoryOrSource)
        if (existing != null) {
            dao.insertPattern(existing.copy(count = existing.count + 1))
        } else {
            dao.insertPattern(CategoryPattern(kind, key, categoryOrSource, count = 1))
        }
    }

    suspend fun applyLearnedCategory(transaction: MpesaTransaction, dao: CategoryPatternDao): MpesaTransaction {
        if (transaction.party.isNullOrBlank()) return transaction

        if (transaction.isExpense) {
            val predicted = predictCategory(transaction.party, "expense", dao)
            if (predicted != null) {
                return transaction.copy(category = predicted, categorized = true)
            }
        }

        if (transaction.isIncome) {
            val predicted = predictCategory(transaction.party, "income", dao)
            if (predicted != null) {
                return transaction.copy(incomeSource = predicted)
            }
        }

        return transaction
    }
}
