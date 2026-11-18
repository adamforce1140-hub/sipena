-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` TEXT NOT NULL,
    `role` ENUM('STAFF', 'SUPERVISOR') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(191) NOT NULL,
    `cifNumber` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `nik` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `emergencyContact` VARCHAR(191) NULL,
    `address` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Customer_cifNumber_key`(`cifNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Financing` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `contractNumber` VARCHAR(191) NOT NULL,
    `productType` VARCHAR(191) NOT NULL,
    `principalAmount` DECIMAL(18, 2) NOT NULL,
    `outstandingBalance` DECIMAL(18, 2) NOT NULL,
    `arrearsMargin` DECIMAL(18, 2) NOT NULL,
    `penaltyAmount` DECIMAL(18, 2) NOT NULL,
    `dpd` INTEGER NOT NULL,
    `collectibility` ENUM('KOL_3', 'KOL_4', 'KOL_5') NOT NULL,
    `collateralType` VARCHAR(191) NULL,
    `collateralValue` DECIMAL(18, 2) NULL,
    `caseStatus` ENUM('DRAFT', 'ACTIVE', 'PENDING_SOLUTION', 'IN_EXECUTION', 'PENDING_CLOSURE', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `isLocked` BOOLEAN NOT NULL DEFAULT false,
    `needsRevision` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Financing_contractNumber_key`(`contractNumber`),
    INDEX `Financing_caseStatus_needsRevision_updatedAt_idx`(`caseStatus`, `needsRevision`, `updatedAt`),
    INDEX `Financing_collectibility_idx`(`collectibility`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CollectionLog` (
    `id` VARCHAR(191) NOT NULL,
    `financingId` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `activityType` ENUM('CALL', 'WHATSAPP', 'VISIT') NOT NULL,
    `notes` TEXT NOT NULL,
    `ptpDate` DATETIME(3) NULL,
    `ptpAmount` DECIMAL(18, 2) NULL,
    `evidenceUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CollectionLog_ptpDate_idx`(`ptpDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaseSolution` (
    `id` VARCHAR(191) NOT NULL,
    `financingId` VARCHAR(191) NOT NULL,
    `proposedById` VARCHAR(191) NOT NULL,
    `solutionType` ENUM('RESTRUCTURE', 'PENALTY_WAIVER', 'WARNING_LETTER_SP1', 'WARNING_LETTER_SP2', 'WARNING_LETTER_SP3', 'COLLATERAL_EXECUTION', 'WRITE_OFF') NOT NULL,
    `proposalSummary` TEXT NOT NULL,
    `proposedAmount` DECIMAL(18, 2) NULL,
    `supportingUrl` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewedById` VARCHAR(191) NULL,
    `supervisorNotes` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CasePayment` (
    `id` VARCHAR(191) NOT NULL,
    `financingId` VARCHAR(191) NOT NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `paymentAmount` DECIMAL(18, 2) NOT NULL,
    `principalPortion` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `marginPortion` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `penaltyPortion` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `paymentDate` DATETIME(3) NOT NULL,
    `receiptUrl` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupervisorGate` (
    `id` VARCHAR(191) NOT NULL,
    `financingId` VARCHAR(191) NOT NULL,
    `supervisorId` VARCHAR(191) NOT NULL,
    `gateStep` ENUM('GATE_1_VERIFY', 'GATE_2_SOLUTION', 'GATE_3_CLOSE') NOT NULL,
    `decision` ENUM('APPROVED', 'REJECTED') NOT NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `oldData` JSON NULL,
    `newData` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('PTP_TODAY', 'PTP_OVERDUE') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `link` VARCHAR(191) NULL,
    `dedupeKey` VARCHAR(191) NOT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Notification_dedupeKey_key`(`dedupeKey`),
    INDEX `Notification_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Financing` ADD CONSTRAINT `Financing_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollectionLog` ADD CONSTRAINT `CollectionLog_financingId_fkey` FOREIGN KEY (`financingId`) REFERENCES `Financing`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollectionLog` ADD CONSTRAINT `CollectionLog_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaseSolution` ADD CONSTRAINT `CaseSolution_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaseSolution` ADD CONSTRAINT `CaseSolution_financingId_fkey` FOREIGN KEY (`financingId`) REFERENCES `Financing`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaseSolution` ADD CONSTRAINT `CaseSolution_proposedById_fkey` FOREIGN KEY (`proposedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CasePayment` ADD CONSTRAINT `CasePayment_financingId_fkey` FOREIGN KEY (`financingId`) REFERENCES `Financing`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CasePayment` ADD CONSTRAINT `CasePayment_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupervisorGate` ADD CONSTRAINT `SupervisorGate_financingId_fkey` FOREIGN KEY (`financingId`) REFERENCES `Financing`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupervisorGate` ADD CONSTRAINT `SupervisorGate_supervisorId_fkey` FOREIGN KEY (`supervisorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

