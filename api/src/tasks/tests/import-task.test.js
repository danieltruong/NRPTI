describe('import-task', () => {
  describe('protectedCreateTask', () => {
    let importTask;

    beforeEach(() => {
      // mock query-actions sendResponse to return whatever is passed to it
      const mockSendResponse = jest.fn(input => {
        return Promise.resolve(input);
      });
      const queryActions = require('../../utils/query-actions');
      queryActions.sendResponse = mockSendResponse;

      // mock task-audit-record class
      jest.mock('../../utils/task-audit-record');

      // require this AFTER its require-mocks have been setup
      importTask = require('../import-task');
    });

    it('throws an error if required task param is missing', async () => {
      const mockArgs = {
        swagger: {
          params: {
            auth_payload: {
              realm_access: {
                roles: 'sysadmin'
              }
            },
            task: null
          }
        }
      };

      await expect(importTask.protectedCreateTask(mockArgs, {})).rejects.toThrow(
        new Error('protectedCreateTask - missing required request body')
      );
    });

    it('throws an error if required task.value param is missing', async () => {
      const mockArgs = {
        swagger: {
          params: {
            auth_payload: {
              realm_access: {
                roles: 'sysadmin'
              }
            },
            task: {
              value: null
            }
          }
        }
      };

      await expect(importTask.protectedCreateTask(mockArgs, {})).rejects.toThrow(
        new Error('protectedCreateTask - missing required request body')
      );
    });

    it('throws an error if required dataSourceType param is missing', async () => {
      const mockArgs = {
        swagger: {
          params: {
            auth_payload: {
              realm_access: {
                roles: 'sysadmin'
              }
            },
            task: {
              value: {
                taskType: 'import',
                recordType: 'order'
              }
            }
          }
        }
      };

      await expect(importTask.protectedCreateTask(mockArgs, {})).rejects.toThrow(
        new Error('protectedCreateTask - missing required dataSourceType')
      );
    });

    it('throws an error if required taskType param is missing', async () => {
      const mockArgs = {
        swagger: {
          params: {
            auth_payload: {
              realm_access: {
                roles: 'sysadmin'
              }
            },
            task: {
              value: {
                dataSourceType: 'epic',
                recordType: 'order'
              }
            }
          }
        }
      };

      await expect(importTask.protectedCreateTask(mockArgs, {})).rejects.toThrow(
        new Error('protectedCreateTask - missing required taskType')
      );
    });
  });
});
