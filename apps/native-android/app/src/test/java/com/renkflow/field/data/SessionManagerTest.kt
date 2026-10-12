package com.renkflow.field.data
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.encodeToString
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.MockResponse
import org.junit.Test
import org.junit.Assert.*
import java.util.Base64
class SessionManagerTest {
    private fun token(sid:String)= "a."+Base64.getUrlEncoder().withoutPadding().encodeToString("""{"sid":"$sid"}""".toByteArray())+".c"
    @Test fun refreshPersistsRequestBeforeNetworkAndRotatesSavedCredentials()=runTest {
        val server=MockWebServer();server.start()
        try {
            val user=User("u","worker@test.invalid",tenantId="t",role="worker")
            var saved:Session?=Session(server.url("/").toString().trimEnd('/'),token("sid"),0,user,"old-refresh","sid","device")
            val writes=mutableListOf<Session>()
            val store=object:SessionStorage {override fun read()=saved;override fun write(value:Session) {saved=value;writes+=value}}
            server.enqueue(MockResponse().setBody("""{"data":${fieldJson.encodeToString(LoginResult(user,token("sid"),900,"rotated","sid","device"))}}"""))
            val result=SessionManager(store).token(saved!!.server,saved!!.token)
            assertEquals(token("sid"),result);assertNotNull(writes.first().refreshRequestId);assertEquals("rotated",saved!!.refreshToken);assertNull(saved!!.refreshRequestId)
            assertTrue(server.takeRequest().body.readUtf8().contains(writes.first().refreshRequestId!!))
        } finally {server.shutdown()}
    }
    @Test fun accountSwitchCannotUseOtherSavedSessionOrSendNetworkRequest()=runTest {
        val saved=Session("https://renkflow.com",token("new"),Long.MAX_VALUE,User("u","x@test.invalid",role="worker",tenantId="t"),sessionId="new")
        val store=object:SessionStorage {override fun read()=saved;override fun write(value:Session) {fail("Should not write")}}
        try {SessionManager(store).token(saved.server,token("old"));fail("Old session should be refused")} catch(e:ApiException) {assertEquals(401,e.status)}
    }
}
