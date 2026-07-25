package com.example.mpesatracker.parser

import com.example.mpesatracker.data.model.MpesaTransaction
import java.text.SimpleDateFormat
import java.util.*

object MpesaParser {

    enum class TransactionType {
        SENT,
        RECEIVED,
        PAYBILL,
        BUY_GOODS,
        WITHDRAW,
        DEPOSIT,
        AIRTIME,
        FULIZA_BORROW,
        FULIZA_REPAY,
        REVERSAL,
        UNKNOWN
    }

    private fun extractAmount(msg: String): Double? {
        val amountRegex = """(?:Ksh|KSh|KES)\s*([\d,]+(?:\.\d{1,2})?)""".toRegex(RegexOption.IGNORE_CASE)
        val match = amountRegex.find(msg) ?: return null
        return match.groupValues[1].replace(",", "").toDoubleOrNull()
    }

    private fun extractConfirmationCode(msg: String): String? {
        val codeRegex = """\b([A-Z0-9]{10})\b""".toRegex()
        return codeRegex.find(msg)?.groupValues?.get(1)
    }

    private fun extractDate(msg: String): Long {
        val dateTimeRegex = """on\s+(\d{1,2})/(\d{1,2})/(\d{2,4})\s+at\s+(\d{1,2}):(\d{2})\s+(AM|PM)""".toRegex(RegexOption.IGNORE_CASE)
        val match = dateTimeRegex.find(msg)
        if (match != null) {
            try {
                val day = match.groupValues[1].toInt()
                val month = match.groupValues[2].toInt() - 1
                var year = match.groupValues[3].toInt()
                if (year < 100) year += 2000
                
                var hour = match.groupValues[4].toInt()
                val minute = match.groupValues[5].toInt()
                val amPm = match.groupValues[6].uppercase()
                
                if (amPm == "PM" && hour < 12) {
                    hour += 12
                } else if (amPm == "AM" && hour == 12) {
                    hour = 0
                }
                
                val calendar = Calendar.getInstance()
                calendar.set(year, month, day, hour, minute, 0)
                calendar.set(Calendar.MILLISECOND, 0)
                return calendar.timeInMillis
            } catch (e: Exception) {
                // fallback to basic date matching
            }
        }
        
        val dateRegex = """(\d{1,2})/(\d{1,2})/(\d{2,4})""".toRegex()
        val dateMatch = dateRegex.find(msg)
        if (dateMatch != null) {
            try {
                val day = dateMatch.groupValues[1].toInt()
                val month = dateMatch.groupValues[2].toInt() - 1
                var year = dateMatch.groupValues[3].toInt()
                if (year < 100) year += 2000
                val calendar = Calendar.getInstance()
                calendar.set(year, month, day, 12, 0, 0)
                return calendar.timeInMillis
            } catch (e: Exception) {
                // fallback
            }
        }
        return System.currentTimeMillis()
    }

    private fun extractParty(msg: String, afterKeyword: String): String? {
        val lowerMsg = msg.lowercase()
        val idx = lowerMsg.indexOf(afterKeyword.lowercase())
        if (idx == -1) return null
        val rest = msg.substring(idx + afterKeyword.length).trim()
        val endRegex = """\b(\d{10,}|on\s|\bfor\b|\bat\b)""".toRegex(RegexOption.IGNORE_CASE)
        val match = endRegex.find(rest)
        return if (match != null) {
            rest.substring(0, match.range.first).trim()
        } else {
            if (rest.length > 40) rest.substring(0, 40).trim() else rest
        }
    }

    private fun suggestCategory(type: TransactionType, msg: String): String? {
        val lower = msg.lowercase()
        if (type == TransactionType.FULIZA_BORROW || type == TransactionType.FULIZA_REPAY) {
            return "LOANS"
        }
        if (type == TransactionType.AIRTIME) {
            return "INTERNET"
        }
        if (lower.contains("kplc") || lower.contains("kenya power") || lower.contains("electricity") || lower.contains("power")) {
            return "ELECTRICITY"
        }
        if (lower.contains("safaricom") && (lower.contains("data") || lower.contains("bundle") || lower.contains("internet"))) {
            return "INTERNET"
        }
        if (lower.contains("nairobi water") || lower.contains("water")) {
            return "ELECTRICITY"
        }
        if (lower.contains("rent") || lower.contains("landlord")) {
            return "RENT"
        }
        return null
    }

    fun isMpesaMessage(body: String?, sender: String = ""): Boolean {
        if (body.isNullOrBlank()) return false
        if (sender.lowercase().contains("mpesa") || sender.lowercase().contains("m-pesa")) return true
        val upperPrefix = body.trim().take(20).uppercase()
        if (upperPrefix.contains("MPESA") || upperPrefix.contains("M-PESA")) return true
        
        // Starts with 10-char alphanumeric code + space
        val codeStartRegex = """^[A-Z0-9]{10}\s""".toRegex(RegexOption.IGNORE_CASE)
        if (codeStartRegex.containsMatchIn(body.trim())) {
            val amountRegex = """(?:Ksh|KSh|KES)\s*[\d,]+""".toRegex(RegexOption.IGNORE_CASE)
            return amountRegex.containsMatchIn(body)
        }
        return false
    }

    fun parseMpesaSms(body: String?, sender: String = "", defaultDate: Long = System.currentTimeMillis()): MpesaTransaction? {
        if (body.isNullOrBlank()) return null

        val isMpesa = isMpesaMessage(body, sender)
        if (!isMpesa) {
            // Last resort keyword check
            val keywordRegex = """\b(m-pesa|mpesa|fuliza)\b""".toRegex(RegexOption.IGNORE_CASE)
            if (!keywordRegex.containsMatchIn(body)) return null
        }

        val msg = body.trim()
        val lower = msg.lowercase()
        val amount = extractAmount(msg) ?: return null
        val code = extractConfirmationCode(msg)
        val txDate = extractDate(msg)

        var type = TransactionType.UNKNOWN
        var party: String? = null
        var isExpense = true
        var isIncome = false
        var balance: Double? = null
        var accountNumber: String? = null
        var paybillNumber: String? = null

        // Extract balance
        val balanceRegex = """(?:new\s+m-pesa\s+balance|balance\s+is|balance:)\s*(?:Ksh|KSh|KES)?\s*([\d,]+(?:\.\d{1,2})?)""".toRegex(RegexOption.IGNORE_CASE)
        val balanceMatch = balanceRegex.find(msg)
        if (balanceMatch != null) {
            balance = balanceMatch.groupValues[1].replace(",", "").toDoubleOrNull()
        }

        if (lower.contains("fuliza")) {
            val borrowRegex = """you have borrowed|you borrowed|fuliza loan of""".toRegex()
            val repayRegex = """repaid|repayment|recovered from your m-pesa""".toRegex()
            if (borrowRegex.containsMatchIn(lower)) {
                type = TransactionType.FULIZA_BORROW
                isExpense = true
            } else if (repayRegex.containsMatchIn(lower)) {
                type = TransactionType.FULIZA_REPAY
                isExpense = true
            } else {
                type = TransactionType.FULIZA_BORROW
                isExpense = true
            }
        } else if ("""confirmed[.,]?\s+you have received|you have received|received\s+(?:Ksh|KSh)""".toRegex().containsMatchIn(lower)) {
            type = TransactionType.RECEIVED
            party = extractParty(msg, "from")
            isExpense = false
            isIncome = true
        } else if ("""deposited to m-pesa|deposit of""".toRegex().containsMatchIn(lower)) {
            type = TransactionType.DEPOSIT
            party = extractParty(msg, "by")
            isExpense = false
            isIncome = true
        } else if (lower.contains("reversal") || lower.contains("reversed")) {
            type = TransactionType.REVERSAL
            isExpense = false
            isIncome = true
        } else if ("""airtime purchase|airtime of|bought airtime""".toRegex().containsMatchIn(lower)) {
            type = TransactionType.AIRTIME
            isExpense = true
        } else if ("""confirmed[.,]?\s+(?:Ksh|KSh).*paid to|paid to|paybill|for account""".toRegex().containsMatchIn(lower)) {
            type = TransactionType.PAYBILL
            party = extractParty(msg, "paid to")
            isExpense = true

            // Account number
            val acRegex = """account\s+([A-Z0-9\-]+)""".toRegex(RegexOption.IGNORE_CASE)
            accountNumber = acRegex.find(msg)?.groupValues?.get(1)

            // Paybill number
            val pbRegex = """(?:paybill number|business number)\s*:?\s*(\d+)""".toRegex(RegexOption.IGNORE_CASE)
            paybillNumber = pbRegex.find(msg)?.groupValues?.get(1)
        } else if (("""paid to|buy goods|merchant""".toRegex().containsMatchIn(lower)) && !lower.contains("for account")) {
            type = TransactionType.BUY_GOODS
            party = extractParty(msg, "to")
            isExpense = true
        } else if (lower.contains("withdrawn from") || lower.contains("cash out")) {
            type = TransactionType.WITHDRAW
            party = extractParty(msg, "from")
            isExpense = true
        } else if ("""confirmed[.,]?\s+(?:Ksh|KSh).*sent to|sent to|you sent""".toRegex().containsMatchIn(lower)) {
            type = TransactionType.SENT
            party = extractParty(msg, "to")
            isExpense = true
        } else {
            type = TransactionType.UNKNOWN
            isExpense = true
        }

        val suggestedCategory = suggestCategory(type, msg)

        return MpesaTransaction(
            id = code ?: "${txDate}-${(0..10000).random()}",
            confirmationCode = code,
            type = type.name,
            amount = amount,
            party = party,
            accountNumber = accountNumber,
            paybillNumber = paybillNumber,
            date = txDate,
            rawMessage = msg,
            isExpense = isExpense,
            isIncome = isIncome,
            balance = balance,
            category = suggestedCategory,
            categorized = suggestedCategory != null,
            incomeSource = if (isIncome) null else null, // income source starts null
            note = null,
            createdAt = defaultDate
        )
    }
}
