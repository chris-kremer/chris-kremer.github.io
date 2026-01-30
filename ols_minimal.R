# Manual OLS - Minimalist Version
wage2 <- read.csv("lwage.csv")

y <- wage2$lwage
educ <- wage2$educ
exper <- wage2$exper
n <- length(y)

# Model 1: lwage = b1 + b2*educ + b3*exper
X <- cbind(1, educ, exper)
k <- ncol(X)
df <- n - k

XtX <- t(X) %*% X
XtX_inv <- solve(XtX)
Xty <- t(X) %*% y
beta <- XtX_inv %*% Xty

y_hat <- X %*% beta
e <- y - y_hat
RSS <- as.numeric(t(e) %*% e)
sigma2 <- RSS / df
se <- sqrt(diag(sigma2 * XtX_inv))
t_stat <- beta / se
p_val <- 2 * pt(-abs(t_stat), df)

TSS <- sum((y - mean(y))^2)
R2 <- 1 - RSS/TSS
R2_adj <- 1 - (RSS/df) / (TSS/(n-1))
F_stat <- ((TSS - RSS)/(k-1)) / (RSS/df)

cat("\n=== MODEL 1: lwage ~ educ + exper ===\n")
cat("Coefficients:\n")
print(data.frame(Estimate=as.numeric(beta), SE=se, t=as.numeric(t_stat), p=as.numeric(p_val),
                 row.names=c("Intercept","educ","exper")))
cat("\nResidual SE:", sqrt(sigma2), "| R2:", R2, "| Adj R2:", R2_adj, "| F:", F_stat, "\n")

# HC3 robust standard errors
h <- diag(X %*% XtX_inv %*% t(X))
hc3_weights <- as.numeric(e)^2 / (1 - h)^2
meat <- t(X * hc3_weights) %*% X
var_hc3 <- XtX_inv %*% meat %*% XtX_inv
se_hc3 <- sqrt(diag(var_hc3))

cat("\n=== HC3 ROBUST STANDARD ERRORS ===\n")
cat("Classical SE:", se, "\n")
cat("HC3 SE:      ", se_hc3, "\n")

# 95% CI with HC3
t_crit <- qt(0.975, df)
ci_lo <- beta - t_crit * se_hc3
ci_hi <- beta + t_crit * se_hc3
cat("\n95% CI (HC3):\n")
print(data.frame(Estimate=as.numeric(beta), Lower=as.numeric(ci_lo), Upper=as.numeric(ci_hi),
                 row.names=c("Intercept","educ","exper")))

# t-test for educ at 2% significance
t_crit_2 <- qt(0.99, df)
t_educ <- as.numeric(beta[2]) / se_hc3[2]
p_educ <- 2 * pt(-abs(t_educ), df)
cat("\n=== T-TEST FOR EDUC (alpha=0.02, HC3) ===\n")
cat("t =", t_educ, "| critical = +/-", t_crit_2, "| p =", p_educ, "\n")
cat("Decision:", ifelse(abs(t_educ) > t_crit_2, "REJECT H0", "FAIL TO REJECT H0"), "\n")

# Model 2: with interaction
educ_exper <- educ * exper
X2 <- cbind(1, educ, exper, educ_exper)
k2 <- ncol(X2)
df2 <- n - k2

X2tX2_inv <- solve(t(X2) %*% X2)
beta2 <- X2tX2_inv %*% (t(X2) %*% y)
e2 <- y - X2 %*% beta2
RSS2 <- as.numeric(t(e2) %*% e2)
sigma2_2 <- RSS2 / df2
se2 <- sqrt(diag(sigma2_2 * X2tX2_inv))
t_stat2 <- beta2 / se2
p_val2 <- 2 * pt(-abs(t_stat2), df2)

R2_2 <- 1 - RSS2/TSS
R2_adj2 <- 1 - (RSS2/df2) / (TSS/(n-1))
F_stat2 <- ((TSS - RSS2)/(k2-1)) / (RSS2/df2)

cat("\n=== MODEL 2: lwage ~ educ + exper + educ*exper ===\n")
cat("Coefficients:\n")
print(data.frame(Estimate=as.numeric(beta2), SE=se2, t=as.numeric(t_stat2), p=as.numeric(p_val2),
                 row.names=c("Intercept","educ","exper","educ:exper")))
cat("\nResidual SE:", sqrt(sigma2_2), "| R2:", R2_2, "| Adj R2:", R2_adj2, "\n")

cat("\nMarginal effect of educ = ", beta2[2], " + ", beta2[4], " * exper\n", sep="")
cat("At exper=0:", beta2[2], "| At exper=10:", beta2[2] + beta2[4]*10, "| At exper=20:", beta2[2] + beta2[4]*20, "\n")

cat("\n=== HYPOTHESIS FOR INTERACTION ===\n")
cat("H0: beta4 = 0 (return to educ does not depend on exper)\n")
cat("H1: beta4 > 0 (one-tailed)\n")

# Model 3: with parental education
idx <- complete.cases(wage2$lwage, wage2$educ, wage2$exper, wage2$meduc, wage2$feduc)
n3 <- sum(idx)
y3 <- wage2$lwage[idx]
educ3 <- wage2$educ[idx]
exper3 <- wage2$exper[idx]
meduc3 <- wage2$meduc[idx]
feduc3 <- wage2$feduc[idx]

X3_r <- cbind(1, educ3, exper3, educ3*exper3)
X3_u <- cbind(1, educ3, exper3, educ3*exper3, meduc3, feduc3)
k3_u <- ncol(X3_u)
df3_u <- n3 - k3_u

beta3_r <- solve(t(X3_r) %*% X3_r) %*% (t(X3_r) %*% y3)
beta3_u <- solve(t(X3_u) %*% X3_u) %*% (t(X3_u) %*% y3)

RSS3_r <- as.numeric(t(y3 - X3_r %*% beta3_r) %*% (y3 - X3_r %*% beta3_r))
RSS3_u <- as.numeric(t(y3 - X3_u %*% beta3_u) %*% (y3 - X3_u %*% beta3_u))

sigma2_3u <- RSS3_u / df3_u
se3_u <- sqrt(diag(sigma2_3u * solve(t(X3_u) %*% X3_u)))
t_stat3 <- beta3_u / se3_u
p_val3 <- 2 * pt(-abs(t_stat3), df3_u)

cat("\n=== MODEL 3: + meduc + feduc (n=", n3, ") ===\n", sep="")
cat("Coefficients:\n")
print(data.frame(Estimate=as.numeric(beta3_u), SE=se3_u, t=as.numeric(t_stat3), p=as.numeric(p_val3),
                 row.names=c("Intercept","educ","exper","educ:exper","meduc","feduc")))

# F-test: H0: beta_meduc = beta_feduc = 0
q <- 2
F3 <- ((RSS3_r - RSS3_u) / q) / (RSS3_u / df3_u)
F_crit <- qf(0.95, q, df3_u)
p_F <- 1 - pf(F3, q, df3_u)

cat("\n=== F-TEST: JOINT SIGNIFICANCE OF PARENTAL EDUCATION ===\n")
cat("H0: beta_meduc = beta_feduc = 0\n")
cat("RSS_r:", RSS3_r, "| RSS_u:", RSS3_u, "\n")
cat("F =", F3, "| F_crit (5%) =", F_crit, "| p =", p_F, "\n")
cat("Decision:", ifelse(F3 > F_crit, "REJECT H0 - jointly significant", "FAIL TO REJECT H0"), "\n")
