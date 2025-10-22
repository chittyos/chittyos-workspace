/**
 * OpenAPI 3.0 Specification for ChittySync Hub API
 * For Custom GPTs and API documentation
 */

export const OPENAPI_YAML = `openapi: 3.0.3
info:
  title: ChittySync Hub API
  description: |
    Git-like omnidirectional todo synchronization for ChittyOS ecosystem.

    Enables distributed todo management across Claude Code, ChatGPT, Claude Desktop,
    and other AI platforms with sophisticated conflict resolution, vector clock
    causality tracking, and three-way merge algorithms.

    **Architecture**: Session → Project → Topic (Three-Tier Sync)
  version: 2.2.0
  contact:
    name: ChittyOS Platform
    url: https://chitty.cc

servers:
  - url: https://sync.chitty.cc
    description: Production server (via gateway)
  - url: https://gateway.chitty.cc/api/todos
    description: Gateway route

security:
  - BearerAuth: []

paths:
  /health:
    get:
      summary: Health check
      description: Check service health (no auth required)
      security: []
      responses:
        '200':
          description: Service is healthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'

  /api/todos:
    post:
      summary: Create todo
      description: Create a new todo with ChittyID
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateTodoRequest'
      responses:
        '201':
          description: Todo created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TodoResponse'

    get:
      summary: List todos
      description: List all todos with optional filters
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, in_progress, completed]
        - name: platform
          in: query
          schema:
            type: string
        - name: session_id
          in: query
          schema:
            type: string
        - name: project_id
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 100
      responses:
        '200':
          description: List of todos
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TodoListResponse'

  /api/todos/{id}:
    get:
      summary: Get todo
      description: Retrieve a single todo by ChittyID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Todo details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TodoResponse'

    put:
      summary: Update todo
      description: Update todo status or content
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateTodoRequest'
      responses:
        '200':
          description: Todo updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TodoResponse'

    delete:
      summary: Delete todo
      description: Soft delete a todo
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Todo deleted
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SuccessResponse'

  /api/todos/sync:
    post:
      summary: Bulk sync
      description: Sync multiple todos with conflict detection
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BulkSyncRequest'
      responses:
        '200':
          description: Sync complete
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BulkSyncResponse'

  /api/todos/since/{timestamp}:
    get:
      summary: Delta sync
      description: Get todos updated since timestamp
      parameters:
        - name: timestamp
          in: path
          required: true
          schema:
            type: integer
            format: int64
      responses:
        '200':
          description: Updated todos
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TodoListResponse'

  /api/sessions/register:
    post:
      summary: Register session
      description: Create or update a working session
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterSessionRequest'
      responses:
        '200':
          description: Session registered
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SessionResponse'

  /api/sessions/{sessionId}/sync:
    post:
      summary: Sync session
      description: Sync session todos to project canonical state
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SessionSyncRequest'
      responses:
        '200':
          description: Session synced
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SessionSyncResponse'

  /api/sessions/{sessionId}:
    get:
      summary: Get session
      description: Retrieve session details
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Session details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SessionResponse'

  /api/sessions/{sessionId}/end:
    post:
      summary: End session
      description: Mark session as inactive
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Session ended
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SuccessResponse'

  /api/projects/{projectId}/sessions:
    get:
      summary: Get project sessions
      description: List all active sessions for a project
      parameters:
        - name: projectId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Project sessions
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProjectSessionsResponse'

  /api/projects/{projectId}/canonical:
    get:
      summary: Get canonical state
      description: Get project's merged canonical state from all sessions
      parameters:
        - name: projectId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Canonical state
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CanonicalStateResponse'

  /api/topics:
    get:
      summary: List topics
      description: List all topics across projects
      responses:
        '200':
          description: Topic list
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TopicListResponse'

  /api/topics/{topicId}:
    get:
      summary: Get topic
      description: Get topic details and statistics
      parameters:
        - name: topicId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Topic details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TopicResponse'

  /api/topics/{topicId}/todos:
    get:
      summary: Get topic todos
      description: Get all todos for a topic across projects
      parameters:
        - name: topicId
          in: path
          required: true
          schema:
            type: string
        - name: project_id
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Topic todos
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TodoListResponse'

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      description: ChittyID authentication token

  schemas:
    HealthResponse:
      type: object
      properties:
        status:
          type: string
          example: healthy
        service:
          type: string
          example: chittysync-hub
        version:
          type: string
          example: 2.2.0
        timestamp:
          type: integer
          format: int64
        database:
          type: string
          enum: [connected, error]
        chittyid_service:
          type: string
          enum: [reachable, unreachable]

    Todo:
      type: object
      properties:
        id:
          type: string
          description: ChittyID from id.chitty.cc
          example: CHITTY-TODO-12345-AB
        content:
          type: string
          example: Deploy to production
        status:
          type: string
          enum: [pending, in_progress, completed]
        activeForm:
          type: string
          example: Deploying to production
        platform:
          type: string
          example: claude-code
        session_id:
          type: string
          example: session-abc123
        project_id:
          type: string
          example: chittyrouter-hash
        topics:
          type: array
          items:
            type: string
          example: [deployment, production, ci-cd]
        createdAt:
          type: integer
          format: int64
        updatedAt:
          type: integer
          format: int64
        metadata:
          type: object

    CreateTodoRequest:
      type: object
      required:
        - content
        - status
      properties:
        content:
          type: string
        status:
          type: string
          enum: [pending, in_progress, completed]
        activeForm:
          type: string
        platform:
          type: string
        session_id:
          type: string
        project_id:
          type: string
        metadata:
          type: object

    UpdateTodoRequest:
      type: object
      properties:
        content:
          type: string
        status:
          type: string
          enum: [pending, in_progress, completed]
        activeForm:
          type: string
        metadata:
          type: object

    RegisterSessionRequest:
      type: object
      required:
        - session_id
        - project_id
        - project_path
      properties:
        session_id:
          type: string
          example: session-abc123
        project_id:
          type: string
          example: chittyrouter-hash
        project_path:
          type: string
          example: /Users/nb/.../chittyrouter
        git_branch:
          type: string
          example: main
        git_commit:
          type: string
          example: a6e6448
        platform:
          type: string
          example: claude-code
        agent_id:
          type: string
          example: claude-001

    SessionSyncRequest:
      type: object
      required:
        - project_id
      properties:
        project_id:
          type: string
        todos:
          type: array
          items:
            $ref: '#/components/schemas/Todo'
        strategy:
          type: string
          enum: [timestamp, status_priority, keep_local, keep_remote]
          default: timestamp

    BulkSyncRequest:
      type: object
      required:
        - todos
      properties:
        todos:
          type: array
          items:
            $ref: '#/components/schemas/CreateTodoRequest'

    TodoResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          $ref: '#/components/schemas/Todo'

    TodoListResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: array
          items:
            $ref: '#/components/schemas/Todo'

    SessionResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
          properties:
            id:
              type: string
            session_id:
              type: string
            project_id:
              type: string
            status:
              type: string
              enum: [active, inactive, archived]

    SessionSyncResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
          properties:
            sessions_synced:
              type: integer
            todos_merged:
              type: integer
            conflicts:
              type: integer
            project_state:
              type: string
            canonical_state:
              type: array
              items:
                $ref: '#/components/schemas/Todo'

    BulkSyncResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
          properties:
            synced:
              type: integer
            conflicts:
              type: integer
            created:
              type: integer
            updated:
              type: integer

    ProjectSessionsResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
          properties:
            project_id:
              type: string
            sessions:
              type: array
              items:
                type: object
            total:
              type: integer

    CanonicalStateResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
          properties:
            project_id:
              type: string
            canonical_todos:
              type: array
              items:
                $ref: '#/components/schemas/Todo'
            last_consolidated:
              type: integer
              format: int64
            contributing_sessions:
              type: array
              items:
                type: object

    TopicListResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: array
          items:
            type: object

    TopicResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object

    SuccessResponse:
      type: object
      properties:
        success:
          type: boolean
        message:
          type: string
`;
