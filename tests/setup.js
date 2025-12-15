import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach, jest } from '@jest/globals';

let mongoServer;

beforeAll(async () => {
    // Increase timeout to avoid flaky starts
    jest.setTimeout(30000);

    // Start Standalone Memory DB (Fast & Stable)
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    console.log("🚀 In-Memory MongoDB running at:", mongoUri);
    await mongoose.connect(mongoUri);

    // Mock Mongoose Transactions globally
    // We return a "ClientSession" like object that Mongoose accepts
    const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
        inTransaction: () => true,
        id: 'mock-session-id',
        get: () => { },
        has: () => { },
        set: () => { },
        constructor: { name: 'ClientSession' }
    };

    // 1. Mock startSession to return our fake session
    jest.spyOn(mongoose, 'startSession').mockImplementation(() => Promise.resolve(mockSession));

    // 2. Mock Query.prototype.session to be a no-op
    jest.spyOn(mongoose.Query.prototype, 'session').mockReturnThis();

    // 3. Mock Model.create to ignore session option
    // Note: Model.create is a static method. We need to handle the variadic arguments.
    // In Mongoose, create(docs, options) or create(doc)
    const originalCreate = mongoose.Model.create;
    jest.spyOn(mongoose.Model, 'create').mockImplementation(function (...args) {
        // args could be [docs, options]
        // valid options object is usually the last or second argument depending on signature
        // But typically for transactions it's: create([docs], { session })

        let options = args.length > 1 ? args[args.length - 1] : null;
        if (options && typeof options === 'object' && options.session) {
            delete options.session;
        }

        // Also checks if "options" was actually just a spread of docs. 
        // Mongoose generic create usually takes (doc, options) or (doc1, doc2...)
        // But the controller consistently uses `create([array], { session })`.
        // So the second arg is options.
        if (Array.isArray(args[0]) && args[1] && args[1].session) {
            delete args[1].session;
        }

        return originalCreate.apply(this, args);
    });

    // 4. Mock Model.prototype.save to ignore session option
    const originalSave = mongoose.Model.prototype.save;
    jest.spyOn(mongoose.Model.prototype, 'save').mockImplementation(function (options, ...rest) {
        if (options && options.session) {
            delete options.session;
        }
        return originalSave.call(this, options, ...rest);
    });

    // 5. Mock findByIdAndDelete to ignore session
    const originalFindByIdAndDelete = mongoose.Model.findByIdAndDelete;
    jest.spyOn(mongoose.Model, 'findByIdAndDelete').mockImplementation(function (id, options) {
        if (options && options.session) {
            delete options.session;
        }
        return originalFindByIdAndDelete.call(this, id, options);
    });

    // 6. Mock updateMany to ignore session
    const originalUpdateMany = mongoose.Model.updateMany;
    jest.spyOn(mongoose.Model, 'updateMany').mockImplementation(function (filter, update, options) {
        if (options && options.session) {
            delete options.session;
        }
        return originalUpdateMany.call(this, filter, update, options);
    });
});

afterAll(async () => {
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    if (mongoServer) {
        await mongoServer.stop();
    }
});

afterEach(async () => {
    jest.clearAllMocks();
});
