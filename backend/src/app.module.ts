import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { InventarioModule } from './inventario/inventario.module';

@Module({
  imports: [DatabaseModule, InventarioModule],
})
export class AppModule {}
