package com.renkflow.field

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.renkflow.field.ui.FieldApp
import com.renkflow.field.ui.FieldTheme

class MainActivity : ComponentActivity() {
    private val model: FieldViewModel by viewModels()
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { FieldTheme { val state by model.state.collectAsStateWithLifecycle(); FieldApp(state, model) } }
    }
    override fun onStart() { super.onStart(); model.foreground() }
}
