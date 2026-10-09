package com.renkflow.field.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import kotlinx.serialization.encodeToString
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class ApiException(val status: Int, message: String) : Exception(message)
val fieldJson = Json { ignoreUnknownKeys = true; explicitNulls = false; encodeDefaults = true }

fun normalizeServer(input: String): String {
    val url = input.trim().toHttpUrlOrNull() ?: throw IllegalArgumentException("Geçerli bir HTTPS adresi girin.")
    require(url.isHttps && url.username.isEmpty() && url.password.isEmpty() && url.encodedPath == "/" && url.query == null && url.fragment == null) { "Adres HTTPS ile başlamalı ve yalnızca alan adını içermeli." }
    return url.toString().trimEnd('/')
}

class Api(private val client: OkHttpClient = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS)
    .readTimeout(35, TimeUnit.SECONDS).callTimeout(45, TimeUnit.SECONDS).followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false).build()) {
    suspend fun raw(server: String, token: String?, path: String, body: String? = null, code: String? = null): JsonElement = withContext(Dispatchers.IO) {
        val url = server.toHttpUrlOrNull()!!.newBuilder().addPathSegments("${MobileContract.basePath.trimStart('/')}/${path.removePrefix("field/")}").apply { if (code != null) addQueryParameter("code", code) }.build()
        val request = Request.Builder().url(url).header("Accept", "application/json").header("X-RenkFlow-App-Version", MobileContract.version).header("X-RenkFlow-Platform", "android").apply {
            token?.let { header("Authorization", "Bearer $it") }
            if (body != null) post(body.toRequestBody("application/json; charset=utf-8".toMediaType()))
        }.build()
        client.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            val json = runCatching { fieldJson.parseToJsonElement(text).jsonObject }.getOrNull()
            if (!response.isSuccessful) throw ApiException(response.code, json?.get("error")?.jsonPrimitive?.contentOrNull ?: "İşlem tamamlanamadı (${response.code}).")
            json?.get("data") ?: throw ApiException(502, "Sunucudan beklenmeyen yanıt alındı.")
        }
    }
    suspend fun login(server: String, email: String, password: String): LoginResult = fieldJson.decodeFromJsonElement(raw(server, null, "auth/login", buildJsonObject { put("email", email); put("password", password) }.toString()))
    suspend fun me(session: Session): User = fieldJson.decodeFromJsonElement(raw(session.server, session.token, "auth/me"))
    suspend fun snapshot(session: Session): Snapshot = fieldJson.decodeFromJsonElement(raw(session.server, session.token, "field/snapshot"))
    suspend fun details(session: Session, id: String): WorkOrder = fieldJson.decodeFromJsonElement(raw(session.server, session.token, "field/work-orders/$id"))
    suspend fun scan(session: Session, code: String): ScanResult = fieldJson.decodeFromJsonElement(raw(session.server, session.token, "field/scan", code = code))
    suspend fun command(session: Session, command: Command): Accepted = fieldJson.decodeFromJsonElement(raw(session.server, session.token, "field/commands", fieldJson.encodeToString(command)))
    suspend fun photo(session: Session, input: PhotoInput): PhotoResult = fieldJson.decodeFromJsonElement(raw(session.server, session.token, "field/files", fieldJson.encodeToString(input)))
}
