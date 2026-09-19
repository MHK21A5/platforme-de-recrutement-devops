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
                    echo '========================================'
                    echo 'DEPLOYMENT VERIFICATION'
                    echo '========================================'

                    echo '[1/4] Checking container state'
                    docker ps

                    backend_running="$(docker inspect -f '{{.State.Running}}' recruitment-backend 2>/dev/null || true)"
                    frontend_running="$(docker inspect -f '{{.State.Running}}' recruitment-frontend 2>/dev/null || true)"
                    echo 'Container status:'
                    echo "- recruitment-backend: ${backend_running:-not running}"
                    echo "- recruitment-frontend: ${frontend_running:-not running}"

                    if [ "$backend_running" != "true" ]; then
                        echo 'ERROR: recruitment-backend is not running'
                        docker logs recruitment-backend || true
                        exit 1
                    fi

                    if [ "$frontend_running" != "true" ]; then
                        echo 'ERROR: recruitment-frontend is not running'
                        docker logs recruitment-frontend || true
                        exit 1
                    fi

                    echo '[2/4] Waiting for frontend readiness'
                    for i in $(seq 1 10); do
                        echo "Frontend readiness attempt $i/10..."
                        if curl --fail --silent --show-error http://localhost:8081/ > /dev/null; then
                            echo 'Frontend HTTP check: PASS'
                            echo 'URL: http://localhost:8081/'
                            break
                        fi

                        if [ "$i" -eq 10 ]; then
                            echo 'Frontend HTTP check: FAIL'
                            echo 'ERROR: recruitment-frontend did not become ready'
                            docker logs recruitment-frontend || true
                            exit 1
                        fi

                        echo 'Frontend not ready yet. Waiting 3 seconds...'
                        sleep 3
                    done

                    echo '[3/4] Waiting for backend readiness'
                    for i in $(seq 1 10); do
                        echo "Backend TCP readiness attempt $i/10..."
                        if bash -c 'echo > /dev/tcp/127.0.0.1/5000' 2>/dev/null; then
                            echo 'Backend TCP check: PASS'
                            echo 'Port: 5000'
                            break
                        fi

                        if [ "$i" -eq 10 ]; then
                            echo 'Backend TCP check: FAIL'
                            echo 'ERROR: recruitment-backend did not become ready'
                            docker logs recruitment-backend || true
                            exit 1
                        fi

                        echo 'Backend not ready yet. Waiting 3 seconds...'
                        sleep 3
                    done

                    echo '[4/4] Checking Docker health status'
                    for i in $(seq 1 10); do
                        backend_health="$(docker inspect -f '{{.State.Health.Status}}' recruitment-backend 2>/dev/null || true)"
                        frontend_health="$(docker inspect -f '{{.State.Health.Status}}' recruitment-frontend 2>/dev/null || true)"
                        echo "Health status attempt $i/10"
                        echo "- backend: ${backend_health:-unknown}"
                        echo "- frontend: ${frontend_health:-unknown}"

                        if [ "$backend_health" = 'unhealthy' ]; then
                            echo 'ERROR: recruitment-backend is unhealthy'
                            docker inspect -f '{{json .State.Health}}' recruitment-backend || true
                            docker logs recruitment-backend || true
                            exit 1
                        fi
                        if [ "$frontend_health" = 'unhealthy' ]; then
                            echo 'ERROR: recruitment-frontend is unhealthy'
                            docker inspect -f '{{json .State.Health}}' recruitment-frontend || true
                            docker logs recruitment-frontend || true
                            exit 1
                        fi
                        if [ "$backend_health" = 'healthy' ] && [ "$frontend_health" = 'healthy' ]; then
                            break
                        fi
                        if [ "$i" -eq 10 ]; then
                            echo 'ERROR: Docker health checks did not become healthy'
                            if [ "$backend_health" != 'healthy' ]; then
                                docker inspect -f '{{json .State.Health}}' recruitment-backend || true
                                docker logs recruitment-backend || true
                            fi
                            if [ "$frontend_health" != 'healthy' ]; then
                                docker inspect -f '{{json .State.Health}}' recruitment-frontend || true
                                docker logs recruitment-frontend || true
                            fi
                            exit 1
                        fi
                        echo 'Health checks are starting. Waiting 3 seconds...'
                        sleep 3
                    done

                    echo 'Health status:'
                    echo '- recruitment-backend: healthy'
                    echo '- recruitment-frontend: healthy'
                    echo '========================================'
                    echo 'DEPLOYMENT VERIFICATION SUCCESS'
                    echo '========================================'
                    echo 'Backend container: RUNNING'
                    echo 'Frontend container: RUNNING'
                    echo 'Backend TCP: PASS'
                    echo 'Frontend HTTP: PASS'
                    echo 'Backend health: HEALTHY'
                    echo 'Frontend health: HEALTHY'
                    echo 'Application URL: http://localhost:8081'
                    echo 'Backend URL: http://localhost:5000'
                    echo '========================================'
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
