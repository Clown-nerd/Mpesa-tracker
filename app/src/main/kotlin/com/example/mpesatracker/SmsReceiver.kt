package com.example.mpesatracker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.SmsMessage
import android.util.Log
import com.example.mpesatracker.data.local.AppDatabase
import com.example.mpesatracker.data.repository.MpesaRepository
import com.example.mpesatracker.parser.MpesaParser
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != "android.provider.Telephony.SMS_RECEIVED") return

        val bundle = intent.extras ?: return
        try {
            val pdus = bundle.get("pdus") as Array<*>? ?: return
            val format = bundle.getString("format")
            val msgs = arrayOfNulls<SmsMessage>(pdus.size)

            val bodyBuilder = StringBuilder()
            var sender = ""
            var timestamp = System.currentTimeMillis()

            for (i in msgs.indices) {
                msgs[i] = SmsMessage.createFromPdu(pdus[i] as ByteArray, format)
                bodyBuilder.append(msgs[i]?.messageBody ?: "")
                if (i == 0) {
                    sender = msgs[i]?.originatingAddress ?: ""
                    timestamp = msgs[i]?.timestampMillis ?: System.currentTimeMillis()
                }
            }

            val body = bodyBuilder.toString()

            if (MpesaParser.isMpesaMessage(body, sender)) {
                val pendingResult = goAsync()
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        val db = AppDatabase.getDatabase(context)
                        val repository = MpesaRepository(db)
                        
                        // Dedup check in repository happens inside saveTransaction
                        val parsed = MpesaParser.parseMpesaSms(body, sender, timestamp)
                        if (parsed != null) {
                            val saved = repository.saveTransaction(parsed)
                            if (saved) {
                                Log.d("SmsReceiver", "Successfully processed real-time Mpesa SMS: ${parsed.id}")
                            }
                        }
                    } catch (e: Exception) {
                        Log.e("SmsReceiver", "Error processing real-time SMS", e)
                    } finally {
                        pendingResult.finish()
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("SmsReceiver", "SMS receiver failed", e)
        }
    }
}
