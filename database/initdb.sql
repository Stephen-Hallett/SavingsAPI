CREATE TABLE
    savings (
        time TIMESTAMPTZ NOT NULL,
        platform VARCHAR NOT NULL,
        account VARCHAR NOT NULL,
        amount DOUBLE PRECISION NOT NULL
    )
WITH
    (
        timescaledb.hypertable,
        timescaledb.partition_column = 'time',
        timescaledb.segmentby = 'platform'
    );