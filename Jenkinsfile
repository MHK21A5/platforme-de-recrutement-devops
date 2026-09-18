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

        stage('Deploy Backend') {
            steps {
                withCredentials([
                    file(
                        credentialsId: 'backend-env-file',
                        variable: 'BACKEND_ENV_FILE'
                    )
                ]) {
                    sh '''
                        docker rm -f recruitment-backend || true
                        docker run -d \
                            --name recruitment-backend \
                            --restart unless-stopped \
                            --env-file "$BACKEND_ENV_FILE" \
                            -p 5000:5000 \
                            recruitment-backend:latest
                    '''
                }
            }
        }

        stage('Deploy Frontend') {
            steps {
                sh '''
                    docker rm -f recruitment-frontend || true
                    docker run -d \
                        --name recruitment-frontend \
                        --restart unless-stopped \
                        -p 8081:80 \
                        recruitment-frontend:latest
                '''
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

                    curl --fail --silent --show-error http://localhost:8081/ > /dev/null
                    curl --silent --show-error --max-time 5 http://localhost:5000/ > /dev/null
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
