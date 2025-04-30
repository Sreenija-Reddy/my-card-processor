# My Card Processor

This project implements a simplified credit card transaction processor as part of a full-stack development interview exercise. It includes a web-based user interface for submitting transactions and viewing reports, a server component with business logic for processing transactions from various file formats, and file-based data persistence.

## How to Run Your Code

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/Sreenija-Reddy/my-card-processor.git](https://github.com/Sreenija-Reddy/my-card-processor.git)
    cd my-card-processor
    ```

2.  **Navigate to the server directory:**
    ```bash
    cd jgretz
    ```

3.  **Install server dependencies:**
    ```bash
    npm install
    ```

4.  **Start the server:**
    ```bash
    npm start
    ```
    The server will start and listen on `http://localhost:3000`. You should see output in the console indicating the server is running and the locations of the project root, data directory, and storage file.

5.  **Open the user interface:**
    Open your web browser and navigate to `http://localhost:3000`. This will serve the `public/index.html` file.

## Functionality

The application provides the following functionality:

* **User Interface:**
    * A tab-based interface with sections for submitting single transactions, uploading transaction files, and viewing reports.
    * A form to manually enter a card number and amount for processing.
    * A file upload section to select and process CSV, JSON, and XML files containing transaction data.
    * A reporting view that summarizes processed transaction volume by card type and day, and lists rejected transactions.

* **Logic:**
    * **Accepts Transaction Records:** Processes transaction records from uploaded CSV, JSON, and XML files located in the `data` directory on server startup and from user-uploaded files.
    * **File Processing:** Reads and parses CSV, JSON, and XML files.
        * **CSV:** Expects files with columns named (case-insensitive) `cardNumber` or `card`, `amount`, and optionally `timestamp`.
        * **JSON:** Expects an array of transaction objects with properties named `cardNumber` or `card`, `amount`, and optionally `timestamp`.
        * **XML:** Expects a root element `transactions` containing multiple `transaction` elements, each with `cardNumber` or `card`, `amount`, and optionally `timestamp` elements.
    * **Card Type Determination:** Determines the card type based on the first digit of the card number:
        * `3`: American Express
        * `4`: Visa
        * `5`: MasterCard
        * `6`: Discover
    * **Card Number Validation:** Validates card numbers based on the leading digit and length (13-16 digits).
    * **Amount Validation:** Ensures the transaction amount is a positive number.
    * **Transaction Processing:** Processes valid transactions and stores them. Invalid or unrecognized card numbers or amounts result in rejected transactions.

* **Persistence:**
    * Transaction data (both processed and rejected) is stored in a file named `transactions.json` within the `jgretz/storage` directory. This ensures data persistence across server restarts.
    * Initial data from files in the `jgretz/data` directory is loaded and processed on server startup.

* **Reporting:**
    * **Total Processed Volume:** Displays the total number of processed transactions and the total processed amount.
    * **By Card Type:** Shows a summary of processed transactions grouped by card type.
    * **By Day:** Provides a summary of processed transactions grouped by the date (based on the timestamp).
    * **Rejected Transactions:** Lists all rejected transactions, including the card number (masked), amount, reason for rejection, and timestamp.

## Decisions and Tradeoffs

* **Data Persistence:** I chose file-based persistence using JSON for simplicity and ease of implementation within the given time frame. For a more robust application, a database (like PostgreSQL or MongoDB) would be a better choice.
* **Card Number Validation:** A basic card number validation is implemented based on the leading digit and length. A more comprehensive validation would involve using the Luhn algorithm.
* **Error Handling:** Basic error handling is implemented on both the client and server sides. More detailed and user-friendly error messages could be provided.
* **UI Framework:** Vanilla JavaScript, HTML, and CSS were used for the user interface to avoid the overhead of learning and integrating a front-end framework within the limited time. A framework like React or Vue would allow for a more component-based and maintainable UI in a larger application.
* **File Processing:** The server handles processing of CSV, JSON, and XML files. For very large files, streaming and batch processing could be implemented to improve performance and memory usage.
* **Security:** Minimal security considerations were taken in this simplified scenario. In a real-world application dealing with financial data, significant attention would need to be paid to data encryption, secure API endpoints, and protection against common web vulnerabilities. CORS is enabled for local development.

## Assumptions and Known Limitations

* **File Format Consistency:** The file processing assumes a consistent structure in the input files (e.g., specific column names in CSV, property names in JSON, element names in XML).
* **Timestamp Format:** The timestamp is assumed to be in a format that JavaScript's `Date` object can parse.
* **No Authentication/Authorization:** The application does not implement any user authentication or authorization.
* **Basic UI:** The user interface is minimal and primarily focused on functionality. Styling and responsiveness could be improved.
* **No Unit Tests:** Due to time constraints, unit tests were not included. In a production application, comprehensive unit and integration tests are crucial.
* **Limited Error Feedback:** Error messages to the user are basic. More specific feedback could enhance the user experience.
* **No Real-time Updates:** Reports are updated only when explicitly requested. Real-time updates using WebSockets could be considered for a more dynamic experience.

This implementation provides a functional foundation for a simplified card transaction processor, covering the core requirements of the interview exercise. Further development would focus on addressing the limitations and incorporating more robust features for a production-ready application.
