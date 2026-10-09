package com.renkflow.field.data
import org.junit.Assert.*
import org.junit.Test
class RetryPolicyTest {
    @Test fun backoffIsBoundedAndDoesNotSpinOffline() {assertEquals(15000L,retryDelay(0));assertEquals(30000L,retryDelay(1));assertTrue(retryDelay(20)<=3600000);assertEquals(retryDelay(8),retryDelay(100))}
    @Test fun cachesAreSeparatedByServerTenantAndUser() {
        val a=Session("https://renkflow.com","secret",Long.MAX_VALUE,User("u","test@example.invalid",null,"worker","t"))
        assertEquals(sessionScope(a),sessionScope(a.copy(token="rotated")));assertNotEquals(sessionScope(a),sessionScope(a.copy(user=a.user.copy(tenantId="other"))));assertNotEquals(sessionScope(a),sessionScope(a.copy(server="https://other.example")))
    }
}
