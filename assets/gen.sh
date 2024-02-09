## PFX Creation taken from https://github.com/Azure/azure-xplat-cli/wiki/Getting-Self-Signed-SSL-Certificates-(.pem-and-.pfx)
## PEM to CER (DER encoded) taken from http://stackoverflow.com/a/405545
## PFX from PEM FIles taken from https://www.ssl.com/how-to/create-a-pfx-p12-certificate-file-using-openssl/


# Install `openssl` package

# Generating a private key: 
openssl genrsa 2048 > private_key.pem

# Generating the self signed certificate: 
openssl req -x509 -new -key private_key.pem -out cert.pem

# Create PFX from PEM: 
openssl pkcs12 -export -in cert.pem -inkey private_key.pem -out cert.pfx

# Obtain CER (DER-encoded) from PEM
openssl x509 -inform pem -in cert.pem -outform der -out cert.cer

# Check PFX certificate
openssl pkcs12 -info -in cert.pfx

# Unify PEM Cert && PEM Key into a PFX file (or PKCS12 certificate)
openssl pkcs12 -export -out certificate.pfx -inkey private_key.pem -in cert.pem