package com.example.mpesatracker.data.local

import androidx.room.*
import com.example.mpesatracker.data.model.ProcessedSmsId

@Dao
interface SmsDao {
    @Query("SELECT smsId FROM processed_sms_ids")
    suspend fun getAllProcessedSmsIds(): List<String>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertProcessedSmsId(processedSmsId: ProcessedSmsId)

    @Query("DELETE FROM processed_sms_ids WHERE smsId NOT IN (SELECT smsId FROM processed_sms_ids ORDER BY createdAt DESC LIMIT 5000)")
    suspend fun pruneProcessedSmsIds()
}
