package com.renkflow.field.data

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.encodeToString
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.*
import org.junit.Test

class ApiTest {
    @Test fun rejectsInsecureOrAmbiguousServerAddresses() {
        listOf("http://renkflow.com", "https://user:password@renkflow.com", "https://renkflow.com/other", "https://renkflow.com?code=1", "https://renkflow.com#fragment").forEach {
            assertTrue(runCatching { normalizeServer(it) }.isFailure)
        }
        assertEquals("https://renkflow.com", normalizeServer(" https://renkflow.com/ "))
    }
    @Test fun sendsBearerAndPreservesScanCodeAsQueryData() = runTest {
        val server = MockWebServer()
        try {
            server.enqueue(MockResponse().setBody("""{"success":true,"data":{"kind":"job","id":"job-1","title":"Kesim","workOrderId":"job-1"}}"""))
            server.start()
            val session = Session(server.url("/").toString(), "test-token", Long.MAX_VALUE, User("u", "x@example.com", "Test", "worker", "t"))
            val result = Api().scan(session, "https://renkflow.com/factory?job=one&unit=two")
            assertEquals("job-1", result.workOrderId)
            val request = server.takeRequest()
            assertEquals("Bearer test-token", request.getHeader("Authorization"))
            assertEquals("/api/mobile/v1/scan", request.requestUrl!!.encodedPath)
            assertEquals(MobileContract.version, request.getHeader("X-RenkFlow-App-Version"))
            assertEquals("android", request.getHeader("X-RenkFlow-Platform"))
            assertEquals("https://renkflow.com/factory?job=one&unit=two", request.requestUrl!!.queryParameter("code"))
        } finally { server.shutdown() }
    }
    @Test fun unauthorizedIsNotReportedAsSuccess() = runTest {
        val server = MockWebServer()
        try {
            server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"Oturum sona erdi"}""")); server.start()
            val result = runCatching { Api().raw(server.url("/").toString(), "expired", "field/snapshot") }
            assertEquals(401, (result.exceptionOrNull() as ApiException).status)
        } finally { server.shutdown() }
    }
    @Test fun redirectsCannotSendCredentialsToAnotherHost() = runTest {
        val server = MockWebServer()
        try {
            server.enqueue(MockResponse().setResponseCode(302).setHeader("Location", "https://example.com/")); server.start()
            val result = runCatching { Api().raw(server.url("/").toString(), "secret", "field/snapshot") }
            assertEquals(302, (result.exceptionOrNull() as ApiException).status)
            assertEquals(1, server.requestCount)
        } finally { server.shutdown() }
    }
    @Test fun commandReplayKeepsIdentityVersionAndQualityResults() {
        val command = Command("00000000-0000-4000-8000-000000000001", data = OperationInput("op", 7, "complete", 2, qualityResults = listOf(QualityResult("length", value = 12.4))))
        val persisted = fieldJson.encodeToString(command)
        assertEquals(persisted, fieldJson.encodeToString(fieldJson.decodeFromString<Command>(persisted)))
        assertEquals(7, fieldJson.decodeFromString<Command>(persisted).data.version)
    }
}
