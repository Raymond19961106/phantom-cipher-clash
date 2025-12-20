
/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const EmployeeSatisfactionSurveyABI = {
  "abi": [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "manager",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "addedBy",
          "type": "address"
        }
      ],
      "name": "ManagerAdded",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "manager",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "removedBy",
          "type": "address"
        }
      ],
      "name": "ManagerRemoved",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "responseId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "employee",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "timestamp",
          "type": "uint256"
        }
      ],
      "name": "SurveySubmitted",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "manager",
          "type": "address"
        }
      ],
      "name": "addManager",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint32",
          "name": "",
          "type": "uint32"
        }
      ],
      "name": "departmentRatingSum",
      "outputs": [
        {
          "internalType": "euint32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint32",
          "name": "",
          "type": "uint32"
        }
      ],
      "name": "departmentResponseCount",
      "outputs": [
        {
          "internalType": "euint32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getAverageRating",
      "outputs": [
        {
          "internalType": "euint32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint32",
          "name": "departmentId",
          "type": "uint32"
        }
      ],
      "name": "getDepartmentStats",
      "outputs": [
        {
          "internalType": "euint32",
          "name": "ratingSum",
          "type": "bytes32"
        },
        {
          "internalType": "euint32",
          "name": "count",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getResponseArrayLength",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getResponseCount",
      "outputs": [
        {
          "internalType": "euint32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getTotalRatingSum",
      "outputs": [
        {
          "internalType": "euint32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "manager",
          "type": "address"
        },
        {
          "internalType": "uint32",
          "name": "departmentId",
          "type": "uint32"
        }
      ],
      "name": "grantDepartmentAccess",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "manager",
          "type": "address"
        },
        {
          "internalType": "uint32[]",
          "name": "departmentIds",
          "type": "uint32[]"
        }
      ],
      "name": "grantMultipleDepartmentAccess",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        },
        {
          "internalType": "uint32",
          "name": "",
          "type": "uint32"
        }
      ],
      "name": "hasSubmittedToDepartment",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "managers",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "protocolId",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "manager",
          "type": "address"
        }
      ],
      "name": "removeManager",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "responses",
      "outputs": [
        {
          "internalType": "euint32",
          "name": "satisfactionRating",
          "type": "bytes32"
        },
        {
          "internalType": "euint32",
          "name": "departmentId",
          "type": "bytes32"
        },
        {
          "internalType": "bytes",
          "name": "encryptedFeedback",
          "type": "bytes"
        },
        {
          "internalType": "uint256",
          "name": "timestamp",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "employeeAddress",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "externalEuint32",
          "name": "encryptedRating",
          "type": "bytes32"
        },
        {
          "internalType": "externalEuint32",
          "name": "encryptedDepartment",
          "type": "bytes32"
        },
        {
          "internalType": "uint32",
          "name": "plaintextDepartmentId",
          "type": "uint32"
        },
        {
          "internalType": "bytes",
          "name": "encryptedFeedback",
          "type": "bytes"
        },
        {
          "internalType": "bytes",
          "name": "ratingProof",
          "type": "bytes"
        },
        {
          "internalType": "bytes",
          "name": "departmentProof",
          "type": "bytes"
        }
      ],
      "name": "submitSurvey",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ]
} as const;

