// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ChittyOS",
    platforms: [
        .macOS(.v13) // macOS Ventura and later
    ],
    products: [
        .executable(
            name: "ChittyOS",
            targets: ["ChittyOS"]
        ),
    ],
    dependencies: [
        // Crypto for ChittyID generation and validation
        .package(url: "https://github.com/apple/swift-crypto.git", from: "3.0.0"),

        // Async algorithms for cloud sync
        .package(url: "https://github.com/apple/swift-async-algorithms", from: "1.0.0"),

        // Collections for data structures
        .package(url: "https://github.com/apple/swift-collections.git", from: "1.0.0"),

        // KeychainAccess for secure token storage
        .package(url: "https://github.com/kishikawakatsumi/KeychainAccess.git", from: "4.2.2"),

        // SwiftSoup for HTML parsing (for Notion content)
        .package(url: "https://github.com/scinfu/SwiftSoup.git", from: "2.6.0"),
    ],
    targets: [
        .executableTarget(
            name: "ChittyOS",
            dependencies: [
                .product(name: "Crypto", package: "swift-crypto"),
                .product(name: "AsyncAlgorithms", package: "swift-async-algorithms"),
                .product(name: "Collections", package: "swift-collections"),
                "KeychainAccess",
                "SwiftSoup",
            ],
            path: "Sources/ChittyOS",
            resources: [
                .process("Resources")
            ]
        ),
        .testTarget(
            name: "ChittyOSTests",
            dependencies: ["ChittyOS"],
            path: "Tests/ChittyOSTests"
        ),
    ]
)