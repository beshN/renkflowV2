package com.renkflow.field.data

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.*
import okhttp3.OkHttpClient
import okhttp3.Request
import org.junit.Assert.*
import org.junit.Test
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.UUID
import javax.net.ssl.*

/** Always runs against the isolated loopback HTTPS fixture; never skips or contacts production. */
class LiveContractTest {
    @Test fun assignedWorkQualityPhotoAndBarcodeThroughRealServer() = runTest(timeout = kotlin.time.Duration.parse("90s")) {
        val trust = object : X509TrustManager {
            override fun getAcceptedIssuers() = emptyArray<X509Certificate>()
            override fun checkClientTrusted(c: Array<X509Certificate>, a: String) = Unit
            override fun checkServerTrusted(c: Array<X509Certificate>, a: String) = Unit
        }
        val tls = SSLContext.getInstance("TLS").apply { init(null, arrayOf(trust), SecureRandom()) }
        // Trust override lives only in the test target and is restricted to the loopback host.
        val client = OkHttpClient.Builder().sslSocketFactory(tls.socketFactory, trust)
            .hostnameVerifier { host, _ -> host == "127.0.0.1" }.followRedirects(false).build()
        val origin = "https://127.0.0.1:3043"
        val fixture = client.newCall(Request.Builder().url("$origin/fixture").build()).execute().use {
            assertEquals(200, it.code); fieldJson.parseToJsonElement(it.body!!.string()).jsonObject
        }
        fun value(key: String) = fixture.getValue(key).jsonPrimitive.content
        val api = Api(client)
        val login = api.login(origin, value("email"), value("password"))
        val session = Session(origin, login.accessToken, Long.MAX_VALUE, login.user)
        assertEquals("worker", api.me(session).role)
        assertTrue(api.snapshot(session).workOrders.any { it.id == value("productionJobId") })
        val job = api.details(session, value("jobId"))
        api.raw(origin, session.token, "work-orders/${job.id}/checklist/${job.checklist.first().id}", """{"completed":false}""")
        api.raw(origin, session.token, "work-orders/${job.id}/comments", """{"body":"Android contract note"}""")
        assertFalse(api.details(session, job.id).checklist.first().completed)
        val start = Command(UUID.randomUUID().toString(), data = OperationInput(value("operationId"), 1, "start"))
        assertTrue(api.command(session, start).accepted); assertTrue(api.command(session, start).accepted)
        val complete = Command(UUID.randomUUID().toString(), data = OperationInput(value("operationId"), 2, "complete", 2, qualityResults = listOf(QualityResult("visual", passed = true))))
        assertTrue(api.command(session, complete).accepted); assertTrue(api.command(session, complete).accepted)
        assertEquals(2.0, api.snapshot(session).operations.first { it.id == value("operationId") }.completedQty, 0.0)
        assertTrue(api.photo(session, PhotoInput(base64 = value("jpeg"), workOrderId = value("productionJobId"))).url.startsWith("/api/v1/production/files/"))
        assertEquals(value("productionJobId"), api.scan(session, value("code")).workOrderId)
    }
}
