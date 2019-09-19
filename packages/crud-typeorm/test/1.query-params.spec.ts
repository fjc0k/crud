import 'jest-extended';
import { Controller, INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestQueryBuilder } from '@nestjsx/crud-request';
import * as request from 'supertest';

import { Company } from '../../../integration/crud-typeorm/companies';
import { withCache } from '../../../integration/crud-typeorm/orm.config';
import { Project } from '../../../integration/crud-typeorm/projects';
import { User } from '../../../integration/crud-typeorm/users';
import { UserProfile } from '../../../integration/crud-typeorm/users-profiles';
import { HttpExceptionFilter } from '../../../integration/shared/https-exception.filter';
import { Crud } from '../../crud/src/decorators/crud.decorator';
import { CompaniesService } from './__fixture__/companies.service';
import { ProjectsService } from './__fixture__/projects.service';
import { UsersService } from './__fixture__/users.service';

// tslint:disable:max-classes-per-file
describe('#crud-typeorm', () => {
  describe('#query params', () => {
    let app: INestApplication;
    let server: any;
    let qb: RequestQueryBuilder;

    @Crud({
      model: { type: Company },
      query: {
        exclude: ['updatedAt'],
        allow: ['id', 'name', 'domain', 'description'],
        filter: [{ field: 'id', operator: 'ne', value: 1 }],
        join: {
          users: {
            allow: ['id'],
          },
        },
        maxLimit: 5,
      },
    })
    @Controller('companies')
    class CompaniesController {
      constructor(public service: CompaniesService) {}
    }

    @Crud({
      model: { type: Project },
      query: {
        join: {
          company: {
            eager: true,
            persist: ['id'],
            exclude: ['updatedAt', 'createdAt'],
          },
        },
        sort: [{ field: 'id', order: 'ASC' }],
        limit: 100,
      },
    })
    @Controller('projects')
    class ProjectsController {
      constructor(public service: ProjectsService) {}
    }

    @Crud({
      model: { type: Project },
    })
    @Controller('projects2')
    class ProjectsController2 {
      constructor(public service: ProjectsService) {}
    }

    @Crud({
      model: { type: Project },
      query: {
        filter: [{ field: 'isActive', operator: 'eq', value: true }],
      },
    })
    @Controller('projects3')
    class ProjectsController3 {
      constructor(public service: ProjectsService) {}
    }

    @Crud({
      model: { type: User },
      query: {
        join: {
          company: {},
          'company.projects': {},
        },
      },
    })
    @Controller('users')
    class UsersController {
      constructor(public service: UsersService) {}
    }

    beforeAll(async () => {
      const fixture = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({ ...withCache, logging: false }),
          TypeOrmModule.forFeature([Company, Project, User, UserProfile]),
        ],
        controllers: [
          CompaniesController,
          ProjectsController,
          ProjectsController2,
          ProjectsController3,
          UsersController,
        ],
        providers: [
          { provide: APP_FILTER, useClass: HttpExceptionFilter },
          CompaniesService,
          UsersService,
          ProjectsService,
        ],
      }).compile();

      app = fixture.createNestApplication();

      await app.init();
      server = app.getHttpServer();
    });

    beforeEach(() => {
      qb = RequestQueryBuilder.create();
    });

    afterAll(async () => {
      app.close();
    });

    describe('#select', () => {
      it('should throw status 400', (done) => {
        const query = qb.setFilter({ field: 'invalid', operator: 'isnull' }).query();
        return request(server)
          .get('/companies')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(400);
            done();
          });
      });
    });

    describe('#query filter', () => {
      it('should return data with limit', (done) => {
        const query = qb.setLimit(4).query();
        return request(server)
          .get('/companies')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(4);
            res.body.forEach((e: Company) => {
              expect(e.id).not.toBe(1);
            });
            done();
          });
      });
      it('should return with maxLimit', (done) => {
        const query = qb.setLimit(7).query();
        return request(server)
          .get('/companies')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(5);
            done();
          });
      });
      it('should return with filter and or, 1', (done) => {
        const query = qb
          .setFilter({ field: 'name', operator: 'notin', value: ['Name2', 'Name3'] })
          .setOr({ field: 'domain', operator: 'cont', value: 5 })
          .query();
        return request(server)
          .get('/companies')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(5);
            done();
          });
      });
      it('should return with filter and or, 2', (done) => {
        const query = qb
          .setFilter({ field: 'name', operator: 'ends', value: 'foo' })
          .setOr({ field: 'name', operator: 'starts', value: 'P' })
          .setOr({ field: 'isActive', operator: 'eq', value: true })
          .query();
        return request(server)
          .get('/projects')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(10);
            done();
          });
      });
      it('should return with filter and or, 3', (done) => {
        const query = qb
          .setOr({ field: 'companyId', operator: 'gt', value: 22 })
          .setFilter({ field: 'companyId', operator: 'gte', value: 6 })
          .setFilter({ field: 'companyId', operator: 'lt', value: 10 })
          .query();
        return request(server)
          .get('/projects')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(8);
            done();
          });
      });
      it('should return with filter and or, 4', (done) => {
        const query = qb
          .setOr({ field: 'companyId', operator: 'in', value: [6, 10] })
          .setOr({ field: 'companyId', operator: 'lte', value: 10 })
          .setFilter({ field: 'isActive', operator: 'eq', value: false })
          .setFilter({ field: 'description', operator: 'notnull' })
          .query();
        return request(server)
          .get('/projects')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(10);
            done();
          });
      });
      it('should return with filter and or, 6', (done) => {
        const query = qb.setOr({ field: 'companyId', operator: 'isnull' }).query();
        return request(server)
          .get('/projects')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(0);
            done();
          });
      });
      it('should return with filter and or, 6', (done) => {
        const query = qb
          .setOr({ field: 'companyId', operator: 'between', value: [1, 5] })
          .query();
        return request(server)
          .get('/projects')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(10);
            done();
          });
      });
      it('should return with filter, 1', (done) => {
        const query = qb.setOr({ field: 'companyId', operator: 'eq', value: 1 }).query();
        return request(server)
          .get('/projects')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(2);
            done();
          });
      });
    });

    describe('#query join', () => {
      it('should return joined entity, 1', (done) => {
        const query = qb.setJoin({ field: 'company', select: ['name'] }).query();
        return request(server)
          .get('/projects/2')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(200);
            expect(res.body.company).toBeDefined();
            done();
          });
      });
      it('should return joined entity, 2', (done) => {
        const query = qb.setJoin({ field: 'users', select: ['name'] }).query();
        return request(server)
          .get('/companies/2')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(200);
            expect(res.body.users).toBeDefined();
            expect(res.body.users.length).not.toBe(0);
            done();
          });
      });
    });

    describe('#query nested join', () => {
      it('should return status 400, 1', (done) => {
        const query = qb
          .setJoin({ field: 'company' })
          .setJoin({ field: 'company.projects' })
          .setFilter({
            field: 'company.projects.foo',
            operator: 'excl',
            value: 'invalid',
          })
          .query();
        return request(server)
          .get('/users/1')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(400);
            done();
          });
      });
      it('should return status 400, 2', (done) => {
        const query = qb
          .setJoin({ field: 'company' })
          .setJoin({ field: 'company.projects' })
          .setFilter({
            field: 'invalid.projects',
            operator: 'excl',
            value: 'invalid',
          })
          .query();
        return request(server)
          .get('/users/1')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(400);
            done();
          });
      });
      it('should return status 400, 3', (done) => {
        const query = qb
          .setJoin({ field: 'company' })
          .setJoin({ field: 'company.projects' })
          .setFilter({
            field: 'company.foo',
            operator: 'excl',
            value: 'invalid',
          })
          .query();
        return request(server)
          .get('/users/1')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(400);
            done();
          });
      });
      it('should return status 200', (done) => {
        const query = qb
          .setJoin({ field: 'company' })
          .setJoin({ field: 'company.projectsinvalid' })
          .query();
        return request(server)
          .get('/users/1')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(200);
            done();
          });
      });
      it('should return joined entity, 1', (done) => {
        const query = qb
          .setFilter({ field: 'company.name', operator: 'excl', value: 'invalid' })
          .setJoin({ field: 'company' })
          .setJoin({ field: 'company.projects' })
          .query();
        return request(server)
          .get('/users/1')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(200);
            expect(res.body.company).toBeDefined();
            expect(res.body.company.projects).toBeDefined();
            done();
          });
      });

      it('should return joined entity, 2', (done) => {
        const query = qb
          .setFilter({ field: 'company.projects.id', operator: 'notnull' })
          .setJoin({ field: 'company' })
          .setJoin({ field: 'company.projects' })
          .query();
        return request(server)
          .get('/users/1')
          .query(query)
          .end((_, res) => {
            expect(res.status).toBe(200);
            expect(res.body.company).toBeDefined();
            expect(res.body.company.projects).toBeDefined();
            done();
          });
      });
    });

    describe('#sort', () => {
      it('should sort by field', async () => {
        const query = qb.sortBy({ field: 'id', order: 'DESC' }).query();
        const res = await request(server)
          .get('/users')
          .query(query)
          .expect(200);
        expect(res.body[1].id).toBeLessThan(res.body[0].id);
      });

      it('should sort by nested field, 1', async () => {
        const query = qb
          .setFilter({ field: 'company.id', operator: 'notnull' })
          .setJoin({ field: 'company' })
          .sortBy({ field: 'company.id', order: 'DESC' })
          .query();
        const res = await request(server)
          .get('/users')
          .query(query)
          .expect(200);
        expect(res.body[res.body.length - 1].company.id).toBeLessThan(
          res.body[0].company.id,
        );
      });

      it('should sort by nested field, 2', async () => {
        const query = qb
          .setFilter({ field: 'id', operator: 'eq', value: 1 })
          .setFilter({ field: 'company.id', operator: 'notnull' })
          .setFilter({ field: 'projects.id', operator: 'notnull' })
          .setJoin({ field: 'company' })
          .setJoin({ field: 'company.projects' })
          .sortBy({ field: 'projects.id', order: 'DESC' })
          .query();
        const res = await request(server)
          .get('/users')
          .query(query)
          .expect(200);
        expect(res.body[0].company.projects[1].id).toBeLessThan(
          res.body[0].company.projects[0].id,
        );
      });

      it('should sort by nested field, 3', async () => {
        const query = qb
          .setFilter({ field: 'id', operator: 'eq', value: 1 })
          .setFilter({ field: 'company.id', operator: 'notnull' })
          .setFilter({ field: 'projects.id', operator: 'notnull' })
          .setJoin({ field: 'company' })
          .setJoin({ field: 'company.projects' })
          .sortBy({ field: 'company.projects.id', order: 'DESC' })
          .query();
        const res = await request(server)
          .get('/users')
          .query(query)
          .expect(200);
        expect(res.body[0].company.projects[1].id).toBeLessThan(
          res.body[0].company.projects[0].id,
        );
      });
    });

    describe('#search', () => {
      const get = () => request(server).get('/projects2');

      it('should return with basic filter', async () => {
        const query = qb.search(qb.cond(['id', 'eq', 1])).query();
        const res = await get()
          .query(query)
          .expect(200);
        expect(res.body).toBeArrayOfSize(1);
        expect(res.body[0].id).toBe(1);
      });

      it('should return with an array of filters, 1', async () => {
        const query = qb
          .search([qb.cond(['id', 'eq', 1]), qb.cond(['name', 'eq', 'Project1'])])
          .query();
        const res = await get()
          .query(query)
          .expect(200);
        expect(res.body).toBeArrayOfSize(1);
        expect(res.body[0].id).toBe(1);
        expect(res.body[0].name).toBe('Project1');
      });

      it('should return with simple AND', async () => {
        const query = qb
          .search({
            and: [qb.cond(['id', 'eq', 2]), qb.cond(['name', 'eq', 'Project2'])],
          })
          .query();
        const res = await get()
          .query(query)
          .expect(200);
        expect(res.body).toBeArrayOfSize(1);
        expect(res.body[0].id).toBe(2);
        expect(res.body[0].name).toBe('Project2');
      });

      it('should return with simple OR', async () => {
        const query = qb
          .search({
            or: [qb.cond(['id', 'eq', 1]), qb.cond(['id', 'eq', 2])],
          })
          .query();
        const res = await get()
          .query(query)
          .expect(200);
        expect(res.body).toBeArrayOfSize(2);
        expect(res.body[0].id).toBe(1);
        expect(res.body[1].id).toBe(2);
      });

      it('should return with compound conditions, 1', async () => {
        const query = qb
          .search({
            and: [
              qb.cond(['isActive', 'eq', true]),
              {
                or: [
                  qb.cond(['name', 'eq', 'Project1']),
                  qb.cond(['name', 'eq', 'Project2']),
                ],
              },
            ],
          })
          .query();
        const res = await get()
          .query(query)
          .expect(200);
        expect(res.body).toBeArrayOfSize(2);
        expect(res.body[0].id).toBe(1);
        expect(res.body[1].id).toBe(2);
      });

      it('should return with compound conditions, 2', async () => {
        const query = qb
          .search({
            and: [
              qb.cond(['isActive', 'eq', false]),
              {
                or: [
                  qb.cond(['name', 'eq', 'Project1']),
                  qb.cond(['name', 'eq', 'Project11']),
                ],
              },
            ],
          })
          .query();
        const res = await get()
          .query(query)
          .expect(200);
        expect(res.body).toBeArrayOfSize(1);
        expect(res.body[0].id).toBe(11);
      });
    });

    describe('#search with mandatory filters', () => {
      const get = () => request(server).get('/projects3');

      it('should return with basic filter, 1', async () => {
        const query = qb.search(qb.cond(['id', 'eq', 1])).query();
        const res = await get()
          .query(query)
          .expect(200);
        expect(res.body).toBeArrayOfSize(1);
        expect(res.body[0].id).toBe(1);
      });

      it('should return with basic filter, 2', async () => {
        const query = qb.search(qb.cond(['id', 'eq', 11])).query();
        const res = await get()
          .query(query)
          .expect(200);
        expect(res.body).toBeArrayOfSize(0);
      });

      it('should return with an array of filters, 1', async () => {
        const query = qb
          .search([qb.cond(['id', 'eq', 1]), qb.cond(['name', 'eq', 'Project1'])])
          .query();
        const res = await get()
          .query(query)
          .expect(200);
        expect(res.body).toBeArrayOfSize(1);
        expect(res.body[0].id).toBe(1);
        expect(res.body[0].name).toBe('Project1');
      });

      it('should return with simple AND, 1', async () => {
        const query = qb
          .search({
            and: [qb.cond(['id', 'eq', 2]), qb.cond(['name', 'eq', 'Project2'])],
          })
          .query();
        const res = await get()
          .query(query)
          .expect(200);
        expect(res.body).toBeArrayOfSize(1);
        expect(res.body[0].id).toBe(2);
        expect(res.body[0].name).toBe('Project2');
      });

      it('should return with simple AND, 2', async () => {
        const query = qb
          .search({
            and: [qb.cond(['id', 'eq', 12]), qb.cond(['name', 'eq', 'Project12'])],
          })
          .query();
        const res = await get()
          .query(query)
          .expect(200);
        expect(res.body).toBeArrayOfSize(0);
      });

      it('should return with simple OR, 1', async () => {
        const query = qb
          .search({
            or: [qb.cond(['id', 'eq', 1]), qb.cond(['id', 'eq', 2])],
          })
          .query();
        const res = await get()
          .query(query)
          .expect(200);
        expect(res.body).toBeArrayOfSize(2);
        expect(res.body[0].id).toBe(1);
        expect(res.body[1].id).toBe(2);
      });

      it('should return with simple OR, 2', async () => {
        const query = qb
          .search({
            or: [qb.cond(['id', 'eq', 12]), qb.cond(['id', 'eq', 2])],
          })
          .query();
        const res = await get()
          .query(query)
          .expect(200);
        expect(res.body).toBeArrayOfSize(1);
        expect(res.body[0].id).toBe(2);
      });
    });
  });
});
