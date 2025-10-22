import XCTest
@testable import ChittyOS

final class ChittyOSTests: XCTestCase {
    func testChittyIDGeneration() {
        let service = ChittyIDService.shared

        Task {
            let result = await service.createID(type: .document, metadata: ["name": "Test Document"])

            switch result {
            case .success(let localID):
                XCTAssertTrue(localID.id.hasPrefix("LOCAL-"))
                XCTAssertEqual(localID.type, .document)
                XCTAssertEqual(localID.status, .pending)
            case .failure(let error):
                XCTFail("Failed to create ID: \(error)")
            }
        }
    }

    func testValidationCaching() {
        let localStorage = ChittyLocalStorage()
        let testID = "VV-G-LLL-SSSS-T-YYYYMM-C-CC"
        let validationResult = ValidationResult(isValid: true, trustLevel: 0.8, error: nil)

        localStorage.cacheValidation(testID, result: validationResult)
        let cached = localStorage.getCachedValidation(testID)

        XCTAssertNotNil(cached)
        XCTAssertEqual(cached?.isValid, true)
        XCTAssertEqual(cached?.trustLevel, 0.8)
    }

    func testOfflineQueue() {
        let queue = ChittyOfflineQueue()
        let localID = LocalChittyID(
            id: "TEST-ID",
            type: .document,
            metadata: [:],
            status: .pending,
            createdAt: Date(),
            needsCloudSync: true
        )

        queue.add(localID)
        let queuedItems = queue.getAll()

        XCTAssertEqual(queuedItems.count, 1)
        XCTAssertEqual(queuedItems.first?.id, "TEST-ID")

        queue.clear()
        XCTAssertEqual(queue.getAll().count, 0)
    }
}