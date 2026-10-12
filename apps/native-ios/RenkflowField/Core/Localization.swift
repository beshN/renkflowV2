import Foundation
func L(_ key:String,_ arguments:String...)->String {
    String(format:NSLocalizedString(key,comment:""),locale:Locale.current,arguments:arguments.map {$0 as NSString})
}
