package com.example.mpesatracker.util

import android.content.Context
import android.net.Uri
import com.example.mpesatracker.data.model.MpesaTransaction
import com.example.mpesatracker.data.repository.MpesaRepository
import com.example.mpesatracker.parser.MpesaParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object SmsReader {

    data class SyncProgress(val processed: Int, val total: Int, val newFound: Int)

    suspend fun readExistingSms(
        context: Context,
        repository: MpesaRepository,
        maxCount: Int = 200,
        onProgress: ((SyncProgress) -> Unit)? = null
    ): List<MpesaTransaction> = withContext(Dispatchers.IO) {
        val newTransactions = mutableListOf<MpesaTransaction>()
        
        val uri = Uri.parse("content://sms/inbox")
        val projection = arrayOf("_id", "address", "body", "date")

        val cursor = context.contentResolver.query(
            uri,
            projection,
            null,
            null,
            "date DESC"
        )

        val processedIds = repository.getProcessedSmsIds().toSet()

        cursor?.use {
            val idIndex = it.getColumnIndex("_id")
            val addressIndex = it.getColumnIndex("address")
            val bodyIndex = it.getColumnIndex("body")
            val dateIndex = it.getColumnIndex("date")

            var count = 0
            val total = it.count
            val limit = minOf(total, maxCount)

            while (it.moveToNext() && count < limit) {
                val smsId = it.getString(idIndex)
                val sender = it.getString(addressIndex) ?: ""
                val body = it.getString(bodyIndex) ?: ""
                val dateMs = it.getLong(dateIndex)

                count++

                if (processedIds.contains(smsId)) {
                    continue
                }

                if (!MpesaParser.isMpesaMessage(body, sender)) {
                    repository.addProcessedSmsId(smsId)
                    continue
                }

                val parsed = MpesaParser.parseMpesaSms(body, sender, dateMs)
                if (parsed != null) {
                    val saved = repository.saveTransaction(parsed)
                    if (saved) {
                        newTransactions.add(parsed)
                    }
                }
                repository.addProcessedSmsId(smsId)

                onProgress?.invoke(SyncProgress(count, limit, newTransactions.size))
            }
        }

        return@withContext newTransactions
    }
}
