import { CrudService } from '../services';
import { CrudRequest, GetManyDefaultResponse, CreateManyDto } from '../interfaces';

export interface CrudController<T> {
  service: CrudService<T>;
  getManyBase?(req: CrudRequest): Promise<GetManyDefaultResponse<T> | T[]>;
  getOneBase?(req: CrudRequest): Promise<T>;
  createOneBase?(req: CrudRequest, dto: T): Promise<T>;
  createManyBase?(req: CrudRequest, dto: CreateManyDto<T>): Promise<T[]>;
  updateOneBase?(req: CrudRequest, dto: T): Promise<T>;
  replaceOneBase?(req: CrudRequest, dto: T): Promise<T>;
  deleteOneBase?(req: CrudRequest): Promise<void | T>;
  preGetManyBase?(req: CrudRequest): Promise<void>;
  preGetOneBase?(req: CrudRequest): Promise<void>;
  preCreateOneBase?(req: CrudRequest, dto: T): Promise<void>;
  preCreateManyBase?(req: CrudRequest, dto: CreateManyDto<T>): Promise<void>;
  preUpdateOneBase?(req: CrudRequest, dto: T): Promise<void>;
  preReplaceOneBase?(req: CrudRequest, dto: T): Promise<void>;
  preDeleteOneBase?(req: CrudRequest): Promise<void>;
}
