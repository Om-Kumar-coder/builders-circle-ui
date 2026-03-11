"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const stallEvaluator_1 = require("./stallEvaluator");
const adjustMultiplier_1 = require("./adjustMultiplier");
const activityArchiver_1 = require("./activityArchiver");
class JobScheduler {
    static start() {
        console.log('Starting job scheduler...');
        // Run stall evaluator daily at 2 AM
        node_cron_1.default.schedule('0 2 * * *', async () => {
            console.log('Running daily stall evaluator job');
            try {
                await stallEvaluator_1.StallEvaluatorJob.run();
            }
            catch (error) {
                console.error('Stall evaluator job failed:', error);
            }
        });
        // Run multiplier adjustment daily at 3 AM (after stall evaluator)
        node_cron_1.default.schedule('0 3 * * *', async () => {
            console.log('Running daily multiplier adjustment job');
            try {
                await adjustMultiplier_1.AdjustMultiplierJob.run();
            }
            catch (error) {
                console.error('Multiplier adjustment job failed:', error);
            }
        });
        // Run activity archiver weekly on Sundays at 4 AM
        node_cron_1.default.schedule('0 4 * * 0', async () => {
            console.log('Running weekly activity archiver job');
            try {
                await activityArchiver_1.ActivityArchiverJob.run();
            }
            catch (error) {
                console.error('Activity archiver job failed:', error);
            }
        });
        console.log('Job scheduler started successfully');
    }
    // Manual job execution for testing/admin purposes
    static async runStallEvaluator() {
        return stallEvaluator_1.StallEvaluatorJob.run();
    }
    static async runMultiplierAdjustment() {
        return adjustMultiplier_1.AdjustMultiplierJob.run();
    }
    static async runActivityArchiver() {
        return activityArchiver_1.ActivityArchiverJob.run();
    }
}
exports.JobScheduler = JobScheduler;
//# sourceMappingURL=scheduler.js.map