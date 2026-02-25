IF OBJECT_ID('dbo.TVIDEOS', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.TVIDEOS', 'NORMA_ID') IS NULL
    BEGIN
        ALTER TABLE dbo.TVIDEOS
            ADD NORMA_ID UNIQUEIDENTIFIER NULL;
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'IX_TVIDEOS_NORMA_ID'
          AND object_id = OBJECT_ID('dbo.TVIDEOS')
    )
    BEGIN
        CREATE INDEX IX_TVIDEOS_NORMA_ID
            ON dbo.TVIDEOS (NORMA_ID)
            INCLUDE (ID, TRILHA_FK_ID, VERSAO);
    END;
END;

IF OBJECT_ID('dbo.TPDFS', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.TPDFS', 'NORMA_ID') IS NULL
    BEGIN
        ALTER TABLE dbo.TPDFS
            ADD NORMA_ID UNIQUEIDENTIFIER NULL;
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'IX_TPDFS_NORMA_ID'
          AND object_id = OBJECT_ID('dbo.TPDFS')
    )
    BEGIN
        CREATE INDEX IX_TPDFS_NORMA_ID
            ON dbo.TPDFS (NORMA_ID)
            INCLUDE (ID, TRILHA_FK_ID, VERSAO);
    END;
END;
