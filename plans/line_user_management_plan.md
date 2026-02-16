# Plan: Migrating `ALLOWED_USERS` to Script Properties

This plan outlines the approach to move the hardcoded `ALLOWED_USERS` list out of the script file `src/api_line_bot.js`. This is in accordance with the **GAS Executive Protocol**.

**Decision:** The user has chosen to proceed with **Plan A**, citing security concerns with using a Google Sheet. The recommended alternative (Plan B) has been rejected.

---

### 1. Core Requirement Restatement

The primary objective is to externalize the `ALLOWED_USERS` configuration from the source code. This enhances security by removing sensitive information from version control and improves maintainability by allowing updates without code deployment.

---

### 2. Chosen Approach: Script Properties

The user list will be stored in Google Apps Script's built-in `PropertiesService`.

*   **Rationale:** This method keeps the configuration within the Apps Script project itself, which aligns with the user's security posture.
*   **Acknowledged Risk:** As noted in the initial analysis, managing a long, comma-separated list of users in a single property string can be cumbersome and prone to formatting errors. The user accepts this trade-off.

---

### 3. Execution Blueprint (Plan A)

1.  **Modify `src/api_line_bot.js`:**
    *   Remove the hardcoded `ALLOWED_USERS` constant.
    *   In its place, insert a call to a new function, `getAllowedUsersFromProperties()`.
    *   This new function will be responsible for:
        *   Reading a script property named `LINE_ALLOWED_USERS`.
        *   Returning an empty array `[]` if the property is not found or is empty.
        *   If the property exists, splitting the comma-separated string of user IDs into a JavaScript array.
        *   Trimming any accidental whitespace from each user ID in the array to prevent validation failures.
    *   The security check `!ALLOWED_USERS.includes(userId)` will be updated to use the list returned by the new function.

2.  **Provide Clear Instructions:**
    *   After the code is implemented, clear, step-by-step instructions will be provided to the user on how to create and manage the `LINE_ALLOWED_USERS` key in `Project Settings > Script Properties`. This includes a specific example of the expected format (e.g., `id_one,id_two,id_three`).

---

### 4. Next Step: Implementation

The next step is to transition to **Code Mode** to execute this plan.
