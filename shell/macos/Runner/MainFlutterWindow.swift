import Cocoa
import FlutterMacOS

class MainFlutterWindow: NSWindow {
  override func awakeFromNib() {
    let flutterViewController = FlutterViewController()
    self.contentViewController = flutterViewController
    // 工作台是三栏布局，默认给足宽度；最小尺寸避免面板挤成一团。
    self.setContentSize(NSSize(width: 1280, height: 800))
    self.minSize = NSSize(width: 960, height: 600)
    self.center()
    self.setFrame(self.frame, display: true)
    RegisterGeneratedPlugins(registry: flutterViewController)

    super.awakeFromNib()
    // 模板的 MainMenu.xib 会在 awakeFromNib 后重置标题，这里再写一次。
    self.title = "Conatus Work"
  }
}
