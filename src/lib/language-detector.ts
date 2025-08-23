import { FileNode } from '@/types'

export interface LanguageSupport {
  extensions: string[]
  frameworks: string[]
  configFiles: string[]
  entryPoints: string[]
  dependencies: string[]
  packageManagers: string[]
  testDirectories: string[]
  buildDirectories: string[]
}

export interface FeatureSupport {
  astAnalysis: boolean
  structureAnalysis: boolean
  frameworkDetection: boolean
  dependencyAnalysis: boolean
  architectureVisualization: boolean
}

export type SupportedLanguage = 
  | 'javascript' 
  | 'typescript' 
  | 'python' 
  | 'java' 
  | 'go' 
  | 'csharp' 
  | 'php' 
  | 'rust' 
  | 'ruby' 
  | 'swift' 
  | 'kotlin' 
  | 'cpp' 
  | 'unknown'

export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageSupport> = {
  javascript: {
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    frameworks: ['React', 'Vue', 'Angular', 'Express', 'Next.js', 'Nuxt'],
    configFiles: ['package.json', 'webpack.config.js', 'babel.config.js', '.eslintrc'],
    entryPoints: ['index.js', 'main.js', 'app.js', 'server.js'],
    dependencies: ['package.json', 'package-lock.json', 'yarn.lock'],
    packageManagers: ['npm', 'yarn', 'pnpm'],
    testDirectories: ['test', '__tests__', 'spec'],
    buildDirectories: ['dist', 'build', 'lib']
  },
  
  typescript: {
    extensions: ['.ts', '.tsx'],
    frameworks: ['React', 'Vue', 'Angular', 'Express', 'Next.js', 'Nest.js'],
    configFiles: ['tsconfig.json', 'webpack.config.ts', 'vite.config.ts'],
    entryPoints: ['index.ts', 'main.ts', 'app.ts', 'server.ts'],
    dependencies: ['package.json', 'package-lock.json', 'yarn.lock'],
    packageManagers: ['npm', 'yarn', 'pnpm'],
    testDirectories: ['test', '__tests__', 'spec'],
    buildDirectories: ['dist', 'build', 'lib']
  },

  python: {
    extensions: ['.py', '.pyx', '.pyi'],
    frameworks: ['Django', 'Flask', 'FastAPI', 'Tornado', 'Pyramid', 'Bottle'],
    configFiles: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile', 'setup.cfg'],
    entryPoints: ['main.py', 'app.py', 'manage.py', '__main__.py', 'run.py'],
    dependencies: ['requirements.txt', 'Pipfile', 'pyproject.toml', 'setup.py'],
    packageManagers: ['pip', 'pipenv', 'poetry', 'conda'],
    testDirectories: ['tests', 'test', '__pycache__'],
    buildDirectories: ['dist', 'build', '__pycache__', '.pytest_cache']
  },

  java: {
    extensions: ['.java', '.class', '.jar'],
    frameworks: ['Spring Boot', 'Spring MVC', 'Hibernate', 'Maven', 'Gradle'],
    configFiles: ['pom.xml', 'build.gradle', 'application.properties', 'application.yml'],
    entryPoints: ['Application.java', 'Main.java', 'App.java'],
    dependencies: ['pom.xml', 'build.gradle', 'ivy.xml'],
    packageManagers: ['maven', 'gradle', 'ant'],
    testDirectories: ['test', 'tests'],
    buildDirectories: ['target', 'build', 'out', 'classes']
  },

  go: {
    extensions: ['.go'],
    frameworks: ['Gin', 'Echo', 'Fiber', 'Gorilla', 'Buffalo'],
    configFiles: ['go.mod', 'go.sum', 'Makefile'],
    entryPoints: ['main.go'],
    dependencies: ['go.mod', 'go.sum'],
    packageManagers: ['go mod'],
    testDirectories: ['test', 'tests'],
    buildDirectories: ['bin', 'pkg', 'vendor']
  },

  csharp: {
    extensions: ['.cs', '.csx', '.vb'],
    frameworks: ['.NET Core', '.NET Framework', 'ASP.NET', 'Blazor', 'Xamarin'],
    configFiles: ['*.csproj', '*.sln', 'appsettings.json', 'web.config'],
    entryPoints: ['Program.cs', 'Startup.cs', 'Main.cs'],
    dependencies: ['*.csproj', 'packages.config', 'project.json'],
    packageManagers: ['nuget', 'dotnet'],
    testDirectories: ['test', 'tests', 'Test'],
    buildDirectories: ['bin', 'obj', 'Debug', 'Release']
  },

  php: {
    extensions: ['.php', '.phtml', '.php3', '.php4', '.php5'],
    frameworks: ['Laravel', 'Symfony', 'CodeIgniter', 'Zend', 'CakePHP'],
    configFiles: ['composer.json', 'php.ini', '.env', 'artisan'],
    entryPoints: ['index.php', 'app.php', 'bootstrap.php'],
    dependencies: ['composer.json', 'composer.lock'],
    packageManagers: ['composer'],
    testDirectories: ['tests', 'test'],
    buildDirectories: ['vendor', 'cache', 'storage']
  },

  rust: {
    extensions: ['.rs'],
    frameworks: ['Actix', 'Rocket', 'Warp', 'Axum', 'Tokio'],
    configFiles: ['Cargo.toml', 'Cargo.lock', 'rust-toolchain'],
    entryPoints: ['main.rs', 'lib.rs'],
    dependencies: ['Cargo.toml', 'Cargo.lock'],
    packageManagers: ['cargo'],
    testDirectories: ['tests', 'test'],
    buildDirectories: ['target', 'pkg']
  },

  ruby: {
    extensions: ['.rb', '.rbw', '.rake'],
    frameworks: ['Ruby on Rails', 'Sinatra', 'Hanami', 'Roda'],
    configFiles: ['Gemfile', 'Rakefile', 'config.ru', '.ruby-version'],
    entryPoints: ['app.rb', 'main.rb', 'application.rb'],
    dependencies: ['Gemfile', 'Gemfile.lock'],
    packageManagers: ['gem', 'bundler'],
    testDirectories: ['test', 'spec'],
    buildDirectories: ['vendor', 'tmp']
  },

  swift: {
    extensions: ['.swift'],
    frameworks: ['SwiftUI', 'UIKit', 'Vapor', 'Perfect'],
    configFiles: ['Package.swift', '*.xcodeproj', 'Podfile'],
    entryPoints: ['main.swift', 'App.swift'],
    dependencies: ['Package.swift', 'Podfile', 'Podfile.lock'],
    packageManagers: ['swift package manager', 'cocoapods', 'carthage'],
    testDirectories: ['Tests', 'test'],
    buildDirectories: ['.build', 'build', 'DerivedData']
  },

  kotlin: {
    extensions: ['.kt', '.kts'],
    frameworks: ['Spring Boot', 'Ktor', 'Android', 'Gradle'],
    configFiles: ['build.gradle.kts', 'pom.xml', 'AndroidManifest.xml'],
    entryPoints: ['Main.kt', 'Application.kt', 'MainActivity.kt'],
    dependencies: ['build.gradle.kts', 'pom.xml'],
    packageManagers: ['gradle', 'maven'],
    testDirectories: ['test', 'androidTest'],
    buildDirectories: ['build', 'target', 'out']
  },

  cpp: {
    extensions: ['.cpp', '.cc', '.cxx', '.c', '.h', '.hpp'],
    frameworks: ['Qt', 'Boost', 'POCO', 'FLTK'],
    configFiles: ['CMakeLists.txt', 'Makefile', 'configure.ac', 'meson.build'],
    entryPoints: ['main.cpp', 'main.c'],
    dependencies: ['CMakeLists.txt', 'Makefile', 'conanfile.txt'],
    packageManagers: ['cmake', 'make', 'conan', 'vcpkg'],
    testDirectories: ['test', 'tests'],
    buildDirectories: ['build', 'bin', 'obj', 'Debug', 'Release']
  },

  unknown: {
    extensions: [],
    frameworks: [],
    configFiles: [],
    entryPoints: [],
    dependencies: [],
    packageManagers: [],
    testDirectories: [],
    buildDirectories: []
  }
}

export class LanguageDetector {
  /**
   * Detect the primary language of a repository based on file extensions
   */
  static detectPrimaryLanguage(files: FileNode[]): SupportedLanguage {
    const languageStats = this.analyzeLanguageDistribution(files)
    const sortedLanguages = Object.entries(languageStats)
      .sort(([, a], [, b]) => b - a)
      .filter(([, count]) => count > 0)

    if (sortedLanguages.length === 0) return 'unknown'
    
    const [primaryLanguage] = sortedLanguages[0]
    return primaryLanguage as SupportedLanguage
  }

  /**
   * Get all languages detected in the repository with their file counts
   */
  static detectAllLanguages(files: FileNode[]): Record<SupportedLanguage, number> {
    return this.analyzeLanguageDistribution(files)
  }

  /**
   * Get supported features for a specific language
   */
  static getSupportedFeatures(language: SupportedLanguage): FeatureSupport {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return {
          astAnalysis: true,
          structureAnalysis: true,
          frameworkDetection: true,
          dependencyAnalysis: true,
          architectureVisualization: true
        }
      
      case 'python':
      case 'java':
      case 'go':
      case 'csharp':
      case 'php':
      case 'rust':
      case 'ruby':
      case 'swift':
      case 'kotlin':
      case 'cpp':
        return {
          astAnalysis: false, // TODO: Implement in future
          structureAnalysis: true,
          frameworkDetection: true,
          dependencyAnalysis: true,
          architectureVisualization: true
        }
      
      default:
        return {
          astAnalysis: false,
          structureAnalysis: true,
          frameworkDetection: false,
          dependencyAnalysis: false,
          architectureVisualization: false
        }
    }
  }

  /**
   * Detect frameworks used in the repository
   */
  static detectFrameworks(files: FileNode[], language: SupportedLanguage): string[] {
    const config = LANGUAGE_CONFIGS[language]
    const detectedFrameworks: string[] = []

    // Check config files for framework indicators
    for (const file of files) {
      if (config.configFiles.some(pattern => this.matchesPattern(file.name, pattern))) {
        // TODO: Implement content-based framework detection
        // For now, just check file existence
        if (language === 'python') {
          if (file.name === 'manage.py') detectedFrameworks.push('Django')
          if (file.name === 'requirements.txt') {
            // Could analyze content for Flask, FastAPI, etc.
          }
        } else if (language === 'java') {
          if (file.name === 'pom.xml') detectedFrameworks.push('Maven')
          if (file.name.includes('gradle')) detectedFrameworks.push('Gradle')
        } else if (language === 'javascript' || language === 'typescript') {
          if (file.name === 'package.json') {
            // Could analyze dependencies for React, Vue, etc.
          }
        }
      }
    }

    return detectedFrameworks
  }

  /**
   * Check if repository is analyzable by current system
   */
  static isFullySupported(language: SupportedLanguage): boolean {
    const features = this.getSupportedFeatures(language)
    return features.astAnalysis
  }

  /**
   * Get language configuration
   */
  static getLanguageConfig(language: SupportedLanguage): LanguageSupport {
    return LANGUAGE_CONFIGS[language]
  }

  // Private helper methods

  private static analyzeLanguageDistribution(files: FileNode[]): Record<SupportedLanguage, number> {
    const stats: Record<SupportedLanguage, number> = {
      javascript: 0,
      typescript: 0,
      python: 0,
      java: 0,
      go: 0,
      csharp: 0,
      php: 0,
      rust: 0,
      ruby: 0,
      swift: 0,
      kotlin: 0,
      cpp: 0,
      unknown: 0
    }

    const countFiles = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file') {
          const language = this.detectFileLanguage(node.name)
          stats[language]++
        }
        if (node.children && node.children.length > 0) {
          countFiles(node.children)
        }
      }
    }

    countFiles(files)
    return stats
  }

  private static detectFileLanguage(fileName: string): SupportedLanguage {
    const extension = this.getFileExtension(fileName)
    
    for (const [language, config] of Object.entries(LANGUAGE_CONFIGS)) {
      if (config.extensions.includes(extension)) {
        return language as SupportedLanguage
      }
    }
    
    return 'unknown'
  }

  private static getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.')
    return lastDot > 0 ? fileName.substring(lastDot) : ''
  }

  private static matchesPattern(fileName: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      // Simple wildcard matching
      const regex = new RegExp(pattern.replace(/\*/g, '.*'))
      return regex.test(fileName)
    }
    return fileName === pattern
  }
}
