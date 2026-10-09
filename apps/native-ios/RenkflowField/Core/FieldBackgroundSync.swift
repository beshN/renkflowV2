import Foundation
import BackgroundTasks

@MainActor enum FieldBackgroundSync {
    static let identifier="com.renkflow.field.sync"
    static weak var foregroundStore: FieldStore?
    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier:identifier,using:nil) {task in
            guard let processing=task as? BGProcessingTask else {task.setTaskCompleted(success:false);return}
            let runner=Task {@MainActor in
                let store=foregroundStore ?? FieldStore()
                await store.restore();await store.sync()
                let pending=store.outbox.contains { $0.state=="pending" || $0.state=="sending" }
                processing.setTaskCompleted(success:!pending && store.error==nil)
                if pending {schedule()}
            }
            processing.expirationHandler={runner.cancel()}
        }
    }
    static func schedule() {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier:identifier)
        let request=BGProcessingTaskRequest(identifier:identifier)
        request.requiresNetworkConnectivity=true;request.requiresExternalPower=false
        request.earliestBeginDate=Date().addingTimeInterval(15*60)
        // iOS controls scheduling; failure doesn't lose work. Foreground sync stays available.
        try? BGTaskScheduler.shared.submit(request)
    }
    static func cancel() {BGTaskScheduler.shared.cancel(taskRequestWithIdentifier:identifier)}
}
