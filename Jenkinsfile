pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                echo 'Repository checkout completed'
            }
        }

        stage('Clean Workspace') {
            steps {
                sh 'rm -rf backend/node_modules frontend/node_modules frontend/dist'
            }
        }

        stage('Install Backend Dependencies') {
            steps {
                dir('backend') {
                    sh 'npm ci'
                }
            }
        }

        stage('Backend Validation') {
            steps {
                dir('backend') {
                    sh 'node --check app.js'
                }
            }
        }

        stage('Backend Tests') {
            steps {
                dir('backend') {
                    sh 'npm test'
                }
            }
        }

        stage('Backend Security Audit') {
            steps {
                dir('backend') {
                    sh 'npm audit --audit-level=high || true'
                }
            }
        }

        stage('Install Frontend Dependencies') {
            steps {
                dir('frontend') {
                    sh 'npm ci'
                }
            }
        }

        stage('Frontend Security Audit') {
            steps {
                dir('frontend') {
                    sh 'npm audit --audit-level=high || true'
                }
            }
        }

        stage('Frontend Lint') {
            steps {
                dir('frontend') {
                    sh 'npm run lint'
                }
            }
        }

        stage('Frontend Build') {
            steps {
                dir('frontend') {
                    sh 'npm run build'
                }
            }
        }

        stage('Archive Frontend Build') {
            steps {
                archiveArtifacts artifacts: 'frontend/dist/**',
                                 fingerprint: true
            }
        }

        stage('Docker Build') {
            steps {
                sh '''
                    docker build \
                        -t recruitment-backend:${BUILD_NUMBER} \
                        -t recruitment-backend:latest \
                        ./backend

                    docker build \
                        -t recruitment-frontend:${BUILD_NUMBER} \
                        -t recruitment-frontend:latest \
                        ./frontend
                '''
            }
        }

        stage('Deploy with Docker Compose') {
            steps {
                withCredentials([
                    file(
                        credentialsId: 'backend-env-file',
                        variable: 'BACKEND_ENV_FILE'
                    )
                ]) {
                    sh '''
                        set +x
                        set -e
                        trap 'rm -f backend.env' EXIT
                        cp "$BACKEND_ENV_FILE" backend.env
                        chmod 600 backend.env

                        docker-compose down || true

                        # One-time migration of containers created by the old docker run stages.
                        for container in recruitment-backend recruitment-frontend; do
                            if [ "$(docker inspect -f '{{if index .Config.Labels "com.docker.compose.project"}}managed{{else}}legacy{{end}}' "$container" 2>/dev/null)" = "legacy" ]; then
                                docker rm -f "$container"
                            fi
                        done

                        docker-compose up -d
                    '''
                }
            }
        }

        stage('Verify Deployment') {
            steps {
                sh '''
                    sleep 5
                    docker ps

                    if [ "$(docker inspect -f '{{.State.Running}}' recruitment-backend 2>/dev/null)" != "true" ]; then
                        docker logs recruitment-backend || true
                        exit 1
                    fi

                    if [ "$(docker inspect -f '{{.State.Running}}' recruitment-frontend 2>/dev/null)" != "true" ]; then
                        docker logs recruitment-frontend || true
                        exit 1
                    fi

                    for i in $(seq 1 10); do
                        if curl --fail --silent --show-error http://localhost:8081/ > /dev/null; then
                            echo "Frontend is ready"
                            break
                        fi

                        if [ "$i" -eq 10 ]; then
                            echo "Frontend failed to become ready"
                            docker logs recruitment-frontend || true
                            exit 1
                        fi

                        echo "Waiting for frontend... attempt $i/10"
                        sleep 3
                    done

                    for i in $(seq 1 10); do
                        if bash -c 'echo > /dev/tcp/127.0.0.1/5000' 2>/dev/null; then
                            echo "Backend is ready"
                            break
                        fi

                        if [ "$i" -eq 10 ]; then
                            echo "Backend failed to become ready"
                            docker logs recruitment-backend || true
                            exit 1
                        fi

                        echo "Waiting for backend... attempt $i/10"
                        sleep 3
                    done
                '''
            }
        }
    }

    post {
        success {
            echo 'CI/CD pipeline completed successfully. Application deployed.'
        }

        failure {
            echo 'CI pipeline failed. Check the logs.'
        }
    }
}
