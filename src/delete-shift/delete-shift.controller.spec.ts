import { Test, TestingModule } from '@nestjs/testing';
import { DeleteShiftController } from './delete-shift.controller';

describe('DeleteShiftController', () => {
  let controller: DeleteShiftController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeleteShiftController],
    }).compile();

    controller = module.get<DeleteShiftController>(DeleteShiftController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
