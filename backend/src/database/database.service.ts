import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as sql from 'mssql/msnodesqlv8';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: sql.ConnectionPool | null = null;

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.close();
      this.logger.log('Conexión a SQL Server cerrada.');
    }
  }

  async connect(): Promise<sql.ConnectionPool> {
    if (this.pool && this.pool.connected) {
      return this.pool;
    }

    const connectionString =
      process.env.DB_CONNECTION_STRING ||
      'Driver={ODBC Driver 18 for SQL Server};Server=.;Database=inventario_db;Trusted_Connection=Yes;TrustServerCertificate=Yes;';

    try {
      this.logger.log('Conectando a SQL Server (inventario_db)...');
      // @ts-ignore
      this.pool = await new sql.ConnectionPool({
        connectionString,
      } as any).connect();
      this.logger.log('Conexión a SQL Server establecida con éxito.');
      return this.pool;
    } catch (error) {
      this.logger.error('Error al conectar con SQL Server:', error);
      throw error;
    }
  }

  getPool(): sql.ConnectionPool {
    if (!this.pool || !this.pool.connected) {
      throw new Error('La conexión a la base de datos no está activa.');
    }
    return this.pool;
  }
}
