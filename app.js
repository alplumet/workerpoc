/**
 * Concept of Worker Threads:
 * --------------------------
 * Node.js runs JavaScript on the V8 engine in a single-threaded event loop, 
 * which can be a performance bottleneck when handling CPU-bound tasks. 
 * Worker threads allow Node.js to execute JavaScript in parallel on separate threads.
 * This can significantly improve performance for CPU-intensive operations 
 * without blocking the main event loop. Each worker thread runs in its own V8 
 * instance and has its own isolated memory.
 * 
 * For more information on Worker Threads, refer to the official Node.js documentation:
 * https://nodejs.org/api/worker_threads.html
 */

/**
 * Concept of Message Queues:
 * --------------------------
 * Message queues provide an asynchronous communication mechanism for different 
 * parts of a system to send messages between them. In the context of our app, 
 * a message queue (implemented by Bull) allows us to offload intensive processing 
 * tasks to a separate process or thread, ensuring the main application remains responsive.
 * The main app adds tasks (or messages) to the queue, and worker processes or threads 
 * pick up and process these tasks. This architecture efficiently distributes processing 
 * load and decouples the main app from the processing logic.
 * 
 * For more information on Bull and its underlying concepts, visit:
 * https://github.com/OptimalBits/bull
 */

// Import necessary modules.
require('dotenv').config();
const { exit } = require('process');
const express = require('express'); // Express is a minimal and flexible Node.js web application framework.
const fileUpload = require('express-fileupload'); // Middleware for handling `multipart/form-data` (file uploads).
const { Worker } = require('worker_threads'); // Node.js native module for spawning worker threads.
const Queue = require('bull'); // Job and message queue based on Redis.
const os = require('os'); // Node.js native module to access OS-specific properties and methods.

const app = express(); // Initialize an Express application.

// Use express-fileupload middleware to handle file uploads. This allows files to be attached to the req object.
app.use(fileUpload());



const {
    REDIS_HOST,
    REDIS_PORT,
    REDIS_USERNAME,
    REDIS_PASSWORD,
} = process.env

const queueOptions = {
  redis: {
    tls: {},
    connectTimeout: 30000,
  }
};

// Initialize the job queue named 'file-processing' using Redis as the storage backend.
// Here, the Redis instance is running locally on the default port 6379.
const processingQueue = new Queue('file-processing', `redis://${REDIS_USERNAME}:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`, queueOptions);

async function clearQueue() {
  await processingQueue.empty();
  await processingQueue.clean(0, 'completed');
  await processingQueue.clean(0, 'failed');
  console.log("Queue cleared");
}
clearQueue();

// Define the endpoint for file uploads. This is the main endpoint where files will be POSTed for processing.
app.post('/upload', (req, res) => {
    // Check if there are any uploaded files.
    console.log(req.files);
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }

    let sampleFileContent = req.files.sampleFile.data.toString('utf8'); // Access the uploaded file. You can choose a custom field name other than 'sampleFile'.

    // Add the file data to our processing queue. This offloads the heavy processing from the main thread.
    processingQueue.add({ fileData: sampleFileContent });

    // Send a response to the client indicating that the file is being processed.
    res.send('File uploaded and processing started!');
});

// Define a simple status endpoint. This can be used to test if the server's main event loop is blocked.
app.get('/status', (req, res) => {
    console.log('- - - - - - - status console log - - - - - -');
    res.send('Event loop is not blocked');
});

// Setup a processor for our queue tasks. This will execute the task using worker threads.
// We aim to process jobs in parallel based on the number of CPUs available. 
processingQueue.process(os.cpus().length, (job) => {
    return new Promise((resolve, reject) => {
        // Initialize a worker thread and pass the file data to it for processing.
        const worker = new Worker('./worker.js', { workerData: job.data.fileData });

        // Listen for messages from the worker thread. This can be the result or any other messages.
        worker.on('message', (message) => {
          console.log(message);  // Log the message from the worker
          resolve();
        });

        // Handle any errors from the worker thread.
        worker.on('error', reject);

        // Handle the exit event of the worker. If the exit wasn't graceful, reject the promise.
        worker.on('exit', (code) => {
            if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
        });
    });
});

// Start the Express server on port 3000.
app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});

// Export the Express app (useful for testing).
module.exports = app; 

