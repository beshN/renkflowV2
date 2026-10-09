package com.renkflow.field.ui

import com.renkflow.field.data.tr
import com.renkflow.field.R
import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@OptIn(ExperimentalMaterial3Api::class)
@androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
@Composable fun CameraScanner(close: () -> Unit, result: (String) -> Unit) {
    val context=LocalContext.current
    val owner=LocalLifecycleOwner.current
    var granted by remember {mutableStateOf(ContextCompat.checkSelfPermission(context,Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)}
    var error by remember {mutableStateOf<String?>(null)}
    val permission=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {granted=it;if(!it) error=tr(R.string.text_kamera_izni_verilmedi_etiket_kodunu_elle_girebil_d6c1a)}
    LaunchedEffect(Unit) {if(!granted) permission.launch(Manifest.permission.CAMERA)}
    ModalBottomSheet(onDismissRequest=close) {
        Column(Modifier.fillMaxWidth().padding(20.dp),verticalArrangement=Arrangement.spacedBy(16.dp)) {
            Text(tr(R.string.text_etiketi_kameraya_gosterin_fced3),style=MaterialTheme.typography.titleLarge)
            if(granted) {
                val preview=remember {PreviewView(context).apply {implementationMode=PreviewView.ImplementationMode.COMPATIBLE}}
                AndroidView(factory={preview},modifier=Modifier.fillMaxWidth().height(320.dp))
                DisposableEffect(owner,preview) {
                    val scanner=BarcodeScanning.getClient() // Bundled model, no first-use model download.
                    val executor=Executors.newSingleThreadExecutor()
                    val active=AtomicBoolean(true);val delivered=AtomicBoolean(false)
                    val providerFuture=ProcessCameraProvider.getInstance(context)
                    val analysis=ImageAnalysis.Builder().setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
                    val cameraPreview=Preview.Builder().build().also {it.surfaceProvider=preview.surfaceProvider}
                    var provider:ProcessCameraProvider?=null
                    analysis.setAnalyzer(executor) {frame ->
                        val media=frame.image
                        if(media==null || !active.get() || delivered.get()) frame.close()
                        else scanner.process(InputImage.fromMediaImage(media,frame.imageInfo.rotationDegrees))
                            .addOnSuccessListener {codes -> codes.firstNotNullOfOrNull {it.rawValue}?.takeIf {it.length<=1000}?.let {code -> if(active.get() && delivered.compareAndSet(false,true)) result(code)}}
                            .addOnFailureListener {if(active.get()) error=tr(R.string.text_etiket_okunamadi_yaklastirin_veya_kodu_elle_giri_2de95)}
                            .addOnCompleteListener {frame.close()}
                    }
                    providerFuture.addListener({
                        if(active.get()) try {provider=providerFuture.get();provider?.bindToLifecycle(owner,CameraSelector.DEFAULT_BACK_CAMERA,cameraPreview,analysis)}
                        catch (_:Exception) {error=tr(R.string.text_kamera_acilamadi_etiket_kodunu_elle_girebilirsin_04e13)}
                    },ContextCompat.getMainExecutor(context))
                    onDispose {active.set(false);analysis.clearAnalyzer();provider?.unbind(cameraPreview,analysis);scanner.close();executor.shutdown()}
                }
            }
            error?.let {Text(it,color=MaterialTheme.colorScheme.error)}
            OutlinedButton(onClick=close,modifier=Modifier.fillMaxWidth().heightIn(min=56.dp)) {Text(tr(R.string.text_elle_girise_don_599bc))}
        }
    }
}
