#!/usr/bin/env python3
"""Generate the checked-in Xcode project deterministically, without third-party tools."""
import hashlib
import json
from pathlib import Path
from xml.sax.saxutils import escape

root = Path(__file__).resolve().parents[1] / 'apps/native-ios'
project_dir = root / 'RenkflowField.xcodeproj'
project_dir.mkdir(exist_ok=True)
objects = {}
contract=json.loads((root.parents[1] / 'contracts/mobile/openapi.json').read_text())
mobile_version=contract['info']['version']
mobile_build=contract['x-build-number']

def identifier(key):
    return hashlib.sha256(key.encode()).hexdigest()[:24].upper()

def quote(value):
    return json.dumps(str(value))

def obj(key, isa, fields):
    ref = identifier(key)
    objects[ref] = f'isa = {isa}; {fields}'
    return ref

def array(items):
    return '(' + ', '.join(items) + (',' if items else '') + ')'

def settings(values):
    return '{ ' + ' '.join(f'{key} = {quote(value)};' for key, value in values.items()) + ' }'

def configurations(key, values):
    refs = []
    for name in ['Debug', 'Release']:
        merged = dict(values)
        merged['SWIFT_OPTIMIZATION_LEVEL'] = '-Onone' if name == 'Debug' else '-O'
        merged['DEBUG_INFORMATION_FORMAT'] = 'dwarf' if name == 'Debug' else 'dwarf-with-dsym'
        if name == 'Debug':
            merged['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = 'DEBUG'
            merged['ENABLE_TESTABILITY'] = 'YES'
        refs.append(obj(f'{key}.{name}', 'XCBuildConfiguration', f'name = {name}; buildSettings = {settings(merged)};'))
    return obj(f'{key}.configs', 'XCConfigurationList', f'buildConfigurations = {array(refs)}; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')

targets = ['RenkflowField', 'RenkflowFieldTests', 'RenkflowFieldUITests']
product_refs, target_refs, groups = [], [], []
for target in targets:
    test = target != 'RenkflowField'
    ui_test = target == 'RenkflowFieldUITests'
    files = sorted((root / target).rglob('*.swift'))
    file_refs, source_builds, resource_builds = [], [], []
    for path in files:
        relative = path.relative_to(root).as_posix()
        ref = obj(relative, 'PBXFileReference', f'lastKnownFileType = sourcecode.swift; path = {quote(relative)}; sourceTree = "<group>";')
        file_refs.append(ref)
        source_builds.append(obj('build.' + relative, 'PBXBuildFile', f'fileRef = {ref};'))
    if not test:
        for name, kind in [('Assets.xcassets', 'folder.assetcatalog'), ('PrivacyInfo.xcprivacy', 'text.xml')]:
            relative = f'{target}/{name}'
            ref = obj(relative, 'PBXFileReference', f'lastKnownFileType = {kind}; path = {quote(relative)}; sourceTree = "<group>";')
            file_refs.append(ref)
            resource_builds.append(obj('build.' + relative, 'PBXBuildFile', f'fileRef = {ref};'))
        localized=obj('localized.tr','PBXFileReference','lastKnownFileType = text.plist.strings; name = tr; path = RenkflowField/tr.lproj/Localizable.strings; sourceTree = "<group>";')
        variant=obj('localized','PBXVariantGroup',f'name = Localizable.strings; children = {array([localized])}; sourceTree = "<group>";')
        file_refs.append(variant)
        resource_builds.append(obj('build.localized','PBXBuildFile',f'fileRef = {variant};'))
        file_refs.append(obj('info' , 'PBXFileReference', 'lastKnownFileType = text.plist.xml; path = RenkflowField/Info.plist; sourceTree = "<group>";'))
    groups.append(obj('group.' + target, 'PBXGroup', f'name = {target}; children = {array(file_refs)}; sourceTree = "<group>";'))
    extension = 'xctest' if test else 'app'
    filetype = 'wrapper.cfbundle' if test else 'wrapper.application'
    product = obj('product.' + target, 'PBXFileReference', f'explicitFileType = {filetype}; includeInIndex = 0; path = {target}.{extension}; sourceTree = BUILT_PRODUCTS_DIR;')
    product_refs.append(product)
    sources = obj('sources.' + target, 'PBXSourcesBuildPhase', f'buildActionMask = 2147483647; files = {array(source_builds)}; runOnlyForDeploymentPostprocessing = 0;')
    resources = obj('resources.' + target, 'PBXResourcesBuildPhase', f'buildActionMask = 2147483647; files = {array(resource_builds)}; runOnlyForDeploymentPostprocessing = 0;')
    frameworks = obj('frameworks.' + target, 'PBXFrameworksBuildPhase', 'buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;')
    values = {'PRODUCT_NAME': '$(TARGET_NAME)', 'PRODUCT_BUNDLE_IDENTIFIER': 'com.renkflow.field' + ('.uitests' if ui_test else '.tests' if test else ''), 'SWIFT_VERSION': '5.0', 'IPHONEOS_DEPLOYMENT_TARGET': '17.0', 'SDKROOT': 'iphoneos', 'TARGETED_DEVICE_FAMILY': '1,2', 'CODE_SIGN_STYLE': 'Automatic', 'CURRENT_PROJECT_VERSION': str(mobile_build), 'MARKETING_VERSION': mobile_version, 'CLANG_ENABLE_MODULES': 'YES', 'SUPPORTED_PLATFORMS': 'iphoneos iphonesimulator'}
    dependencies = []
    if test:
        values['GENERATE_INFOPLIST_FILE'] = 'YES'
        values['LD_RUNPATH_SEARCH_PATHS'] = '$(inherited) @executable_path/Frameworks @loader_path/Frameworks'
        if ui_test:
            values['TEST_TARGET_NAME'] = 'RenkflowField'
        else:
            values['TEST_HOST'] = '$(BUILT_PRODUCTS_DIR)/RenkflowField.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/RenkflowField'
            values['BUNDLE_LOADER'] = '$(TEST_HOST)'
        proxy = obj('proxy.' + target, 'PBXContainerItemProxy', f'containerPortal = {identifier("project")}; proxyType = 1; remoteGlobalIDString = {identifier("target.RenkflowField")}; remoteInfo = RenkflowField;')
        dependencies.append(obj('dependency.' + target, 'PBXTargetDependency', f'target = {identifier("target.RenkflowField")}; targetProxy = {proxy};'))
    else:
        values.update({'INFOPLIST_FILE': 'RenkflowField/Info.plist', 'ASSETCATALOG_COMPILER_APPICON_NAME': 'AppIcon', 'LD_RUNPATH_SEARCH_PATHS': '$(inherited) @executable_path/Frameworks', 'ENABLE_PREVIEWS': 'YES'})
    configs = configurations('config.' + target, values)
    product_type = 'com.apple.product-type.bundle.ui-testing' if ui_test else 'com.apple.product-type.bundle.unit-test' if test else 'com.apple.product-type.application'
    target_refs.append(obj('target.' + target, 'PBXNativeTarget', f'name = {target}; productName = {target}; productReference = {product}; productType = {quote(product_type)}; buildConfigurationList = {configs}; buildPhases = {array([sources, frameworks, resources])}; buildRules = (); dependencies = {array(dependencies)};'))

products = obj('products', 'PBXGroup', f'name = Products; children = {array(product_refs)}; sourceTree = "<group>";')
main_group = obj('main', 'PBXGroup', f'children = {array(groups + [products])}; sourceTree = "<group>";')
configs = configurations('project', {'CLANG_ENABLE_MODULES': 'YES', 'CLANG_ENABLE_OBJC_ARC': 'YES', 'SWIFT_VERSION': '5.0', 'IPHONEOS_DEPLOYMENT_TARGET': '17.0'})
project = obj('project', 'PBXProject', f'attributes = {{ LastUpgradeCheck = 1600; BuildIndependentTargetsInParallel = YES; }}; buildConfigurationList = {configs}; compatibilityVersion = "Xcode 14.0"; developmentRegion = tr; hasScannedForEncodings = 0; knownRegions = (tr, en, Base,); mainGroup = {main_group}; productRefGroup = {products}; projectDirPath = ""; projectRoot = ""; targets = {array(target_refs)};')
output = '// !$*UTF8*$!\n{\n archiveVersion = 1; classes = {}; objectVersion = 56;\n objects = {\n'
output += '\n'.join(f'  {key} = {{ {value} }};' for key, value in sorted(objects.items()))
output += f'\n }};\n rootObject = {project};\n}}\n'
(project_dir / 'project.pbxproj').write_text(output)

scheme_dir = project_dir / 'xcshareddata/xcschemes'
scheme_dir.mkdir(parents=True, exist_ok=True)
def buildable(target):
    return f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{identifier("target." + target)}" BuildableName="{target}.{"app" if target == "RenkflowField" else "xctest"}" BlueprintName="{target}" ReferencedContainer="container:RenkflowField.xcodeproj"/>'

entries = ''.join(f'<BuildActionEntry buildForTesting="YES" buildForRunning="{"YES" if target == "RenkflowField" else "NO"}" buildForProfiling="YES" buildForArchiving="{"YES" if target == "RenkflowField" else "NO"}" buildForAnalyzing="YES">{buildable(target)}</BuildActionEntry>' for target in targets)
testables = ''.join(f'<TestableReference skipped="NO" parallelizable="NO">{buildable(target)}</TestableReference>' for target in targets[1:])
scheme = f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries>{entries}</BuildActionEntries></BuildAction>
<TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables>{testables}</Testables></TestAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{buildable('RenkflowField')}</BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{buildable('RenkflowField')}</BuildableProductRunnable></ProfileAction>
<AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>'''
(scheme_dir / 'RenkflowField.xcscheme').write_text(scheme)
print(f'Generated {project_dir.relative_to(root.parent.parent)}')
